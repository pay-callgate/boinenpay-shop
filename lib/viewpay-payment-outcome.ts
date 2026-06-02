import {
  PAYMENT_SUCCESS_STATUSES,
  readAmountFromViewpayInfo,
  readPaymentStatusFromViewpayInfo,
} from "@/lib/viewpay-order-completion";

export type ViewpayPaymentOutcome = "user_cancel" | "system_error";

export type ViewpayFailureClassification = {
  outcome: ViewpayPaymentOutcome;
  code?: string;
  message: string;
};

const USER_CANCEL_MESSAGE_PATTERNS = [
  /cancel/i,
  /사용자\s*취소/,
  /결제\s*취소/,
  /취소\s*되었/,
  /user\s*cancel/i,
];

const CANCEL_STATUS_PATTERNS = [/cancel/i, /취소/];

const APPROVAL_KEY_PATTERN =
  /^(approval(no|num|number|code)?|auth(no|num|number|code)?|approve(no|num)?|paidat|paid_at|approvaltime|approvaldate|transactiontime|cardapproval)/i;

function deepFindByKeyPattern(obj: unknown, keyPattern: RegExp): unknown[] {
  const found: unknown[] = [];
  if (obj == null || typeof obj !== "object") return found;
  if (Array.isArray(obj)) {
    for (const item of obj) found.push(...deepFindByKeyPattern(item, keyPattern));
    return found;
  }
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (keyPattern.test(k) && v != null && v !== "") found.push(v);
    found.push(...deepFindByKeyPattern(v, keyPattern));
  }
  return found;
}

/**
 * 승인번호·승인시각·양수 금액 등 — 하나라도 있으면 보수적으로 system_error
 */
export function hasViewpayApprovalTrace(
  paymentInfo: Record<string, unknown> | null | undefined
): boolean {
  if (!paymentInfo) return false;

  const hits = deepFindByKeyPattern(paymentInfo, APPROVAL_KEY_PATTERN);
  for (const h of hits) {
    if (typeof h === "string" && h.trim().length >= 4) return true;
    if (typeof h === "number" && Number.isFinite(h) && h > 0) return true;
  }

  const amount = readAmountFromViewpayInfo(paymentInfo);
  if (amount != null && amount > 0) return true;

  return false;
}

export function extractViewpayStatusCode(
  paymentInfo: Record<string, unknown> | null | undefined,
  message?: string
): string | undefined {
  if (paymentInfo) {
    const { paymentStatus } = readPaymentStatusFromViewpayInfo(paymentInfo);
    if (paymentStatus && !PAYMENT_SUCCESS_STATUSES.includes(paymentStatus)) {
      return paymentStatus;
    }
  }
  if (message) {
    const m = message.match(/\(상태:\s*([^)]+)\)/);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
}

function messageSuggestsUserCancel(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  return USER_CANCEL_MESSAGE_PATTERNS.some((p) => p.test(t));
}

function statusSuggestsUserCancel(paymentInfo: Record<string, unknown> | null | undefined): boolean {
  if (!paymentInfo) return false;
  const { paymentStatus, rawStatus } = readPaymentStatusFromViewpayInfo(paymentInfo);
  const candidates = [paymentStatus, typeof rawStatus === "string" ? rawStatus : undefined];
  for (const c of candidates) {
    if (c && c !== "7001" && CANCEL_STATUS_PATTERNS.some((p) => p.test(c))) return true;
  }
  return false;
}

/** 7001 + 승인 흔적 없음 = 순수 결제창 닫기 */
function isPure7001WindowClose(
  paymentInfo: Record<string, unknown> | null | undefined,
  code: string | undefined
): boolean {
  if (code !== "7001") return false;
  return !hasViewpayApprovalTrace(paymentInfo);
}

/**
 * ViewPay 결제 실패 2-Track 분류 (보수적: 애매하면 system_error)
 */
export function classifyViewpayPaymentFailure(params: {
  paymentInfo?: Record<string, unknown> | null;
  message: string;
  httpStatus?: number;
}): ViewpayFailureClassification {
  const message = params.message?.trim() || "결제가 완료되지 않았습니다.";
  const code = extractViewpayStatusCode(params.paymentInfo ?? null, message);
  const info = params.paymentInfo ?? null;

  if (params.httpStatus != null && params.httpStatus >= 500) {
    return { outcome: "system_error", code: code ?? String(params.httpStatus), message };
  }

  if (hasViewpayApprovalTrace(info)) {
    return { outcome: "system_error", code, message };
  }

  if (messageSuggestsUserCancel(message)) {
    return { outcome: "user_cancel", code, message };
  }

  if (statusSuggestsUserCancel(info)) {
    return { outcome: "user_cancel", code, message };
  }

  if (isPure7001WindowClose(info, code)) {
    return { outcome: "user_cancel", code, message };
  }

  return { outcome: "system_error", code, message };
}
