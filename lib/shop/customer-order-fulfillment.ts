/**
 * 쇼핑몰 고객용 주문 진행 4단계 (결제 완료 → 상품 준비중 → 배송 출발 → 배송 완료).
 * 입금대기 등 미결제 주문은 목록에서 제외하고, 상세에서는 Stepper 대신 결제 안내 유지.
 */

export type ShopFulfillmentStageKey =
  | "payment_done"
  | "crafting"
  | "departure"
  | "complete";

export type ShopOrderTabKey = "all" | ShopFulfillmentStageKey;

/** 상단 탭 ↔ 카드 뱃지 문구 1:1 */
export const SHOP_ORDER_FULFILLMENT_TABS: readonly {
  key: ShopOrderTabKey;
  label: string;
}[] = [
  { key: "all", label: "전체" },
  { key: "payment_done", label: "결제 완료" },
  { key: "crafting", label: "상품 준비중" },
  { key: "departure", label: "배송 출발" },
  { key: "complete", label: "배송 완료" },
] as const;

/** Stepper 가로 라벨 (탭과 동일 4단계) */
export const ORDER_PROGRESS_STEP_LABELS: readonly string[] = [
  "결제 완료",
  "상품 준비중",
  "배송 출발",
  "배송 완료",
];

const PAYMENT_DONE_DB_STATUSES = new Set(["received", "confirmed", "paid"]);
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const COMPLETE_MIN_ELAPSED_MS = 15 * 60 * 60 * 1000;
const HOUR_1_MS = 1 * 60 * 60 * 1000;
const HOUR_5_MS = 5 * 60 * 60 * 1000;
const HOUR_15_MS = 15 * 60 * 60 * 1000;

/**
 * 주문 목록 API `shopStage` 필터와 동일한 DB `status` 집합 (Single Source of Truth).
 * `payment_status = paid` 와 함께 사용.
 */
export const SHOP_FULFILLMENT_STAGE_DB_STATUSES: Record<
  ShopFulfillmentStageKey,
  readonly string[]
> = {
  payment_done: ["received", "confirmed", "paid"],
  crafting: ["preparing"],
  departure: ["shipping"],
  complete: ["delivered", "confirmed_purchase"],
} as const;

/** `resolveShopFulfillmentStage`와 동일 규칙으로 단계별 건수 집계 (미결제·취소 등은 제외) */
export function countOrdersByShopFulfillmentStage(
  orders: {
    status: string;
    payment_status?: string | null;
    paid_at?: string | null;
    created_at?: string | null;
    desired_delivery_date?: string | null;
  }[],
  now = new Date()
): Record<ShopFulfillmentStageKey, number> {
  const out: Record<ShopFulfillmentStageKey, number> = {
    payment_done: 0,
    crafting: 0,
    departure: 0,
    complete: 0,
  };
  for (const o of orders) {
    const r = resolveShopCustomerDisplayStage(o, now);
    if (r.kind === "stage") out[r.stage] += 1;
  }
  return out;
}

/** 배지 배경 / 글자 — 회색 배지 사용 안 함 */
export const SHOP_FULFILLMENT_BADGE: Record<
  ShopFulfillmentStageKey,
  { background: string; color: string }
> = {
  payment_done: { background: "#E0F2FE", color: "#0284C7" },
  crafting: { background: "#FFEDD5", color: "#C2410C" },
  departure: { background: "#EEF2FF", color: "#4338CA" },
  complete: { background: "#F3F4F6", color: "#111827" },
};

export const SHOP_CANCELLED_BADGE = {
  background: "#FEE2E2",
  color: "#B91C1C",
} as const;

export const SHOP_PENDING_PAYMENT_BADGE = {
  background: "#FEF3C7",
  color: "#B45309",
} as const;

function isPaid(order: { payment_status?: string | null }): boolean {
  return String(order.payment_status ?? "").trim() === "paid";
}

function parseDateLike(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseKstDateTime(ymd: string, hour: number, minute = 0): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utcMs = Date.UTC(y, mo - 1, d, hour - 9, minute, 0, 0);
  const out = new Date(utcMs);
  if (Number.isNaN(out.getTime())) return null;
  return out;
}

function nextKstMidnight(from: Date): Date {
  const kst = new Date(from.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const nextMidnightUtcMs = Date.UTC(y, m, d + 1, -9, 0, 0, 0);
  return new Date(nextMidnightUtcMs);
}

function stageRank(stage: ShopFulfillmentStageKey): number {
  switch (stage) {
    case "payment_done":
      return 0;
    case "crafting":
      return 1;
    case "departure":
      return 2;
    case "complete":
      return 3;
    default:
      return -1;
  }
}

function laterStage(a: ShopFulfillmentStageKey, b: ShopFulfillmentStageKey): ShopFulfillmentStageKey {
  return stageRank(a) >= stageRank(b) ? a : b;
}

function resolveSimulationStageByElapsed(elapsedMs: number): ShopFulfillmentStageKey {
  if (elapsedMs < HOUR_1_MS) return "payment_done";
  if (elapsedMs < HOUR_5_MS) return "crafting";
  if (elapsedMs < HOUR_15_MS) return "departure";
  return "departure";
}

function resolveDisplayCompleteAt(paidAt: Date, desiredDeliveryDate?: string | null): Date {
  const paidNextMidnight = nextKstMidnight(paidAt);
  const desiredDeadline = parseKstDateTime(desiredDeliveryDate ?? "", 21, 0);
  if (!desiredDeadline) return paidNextMidnight;
  return desiredDeadline.getTime() > paidNextMidnight.getTime() ? desiredDeadline : paidNextMidnight;
}

/**
 * DB 주문 status → 고객 4단계. 미결제·취소는 별도.
 */
export function resolveShopFulfillmentStage(order: {
  status: string;
  payment_status?: string | null;
}):
  | { kind: "stage"; stage: ShopFulfillmentStageKey }
  | { kind: "pending" }
  | { kind: "cancelled" }
  | { kind: "unknown" } {
  const st = String(order.status ?? "").trim();
  if (st === "cancelled" || st === "returned") {
    return { kind: "cancelled" };
  }
  if (!isPaid(order)) {
    return { kind: "pending" };
  }
  if (PAYMENT_DONE_DB_STATUSES.has(st)) {
    return { kind: "stage", stage: "payment_done" };
  }
  if (st === "preparing") {
    return { kind: "stage", stage: "crafting" };
  }
  if (st === "shipping") {
    return { kind: "stage", stage: "departure" };
  }
  if (st === "delivered" || st === "confirmed_purchase") {
    return { kind: "stage", stage: "complete" };
  }
  if (st === "pending_payment") {
    return { kind: "pending" };
  }
  return { kind: "unknown" };
}

/**
 * 고객 노출용 단계(시뮬레이션 포함).
 * - 비정상 상태/미결제/취소는 DB 기준 그대로 반환
 * - 결제 완료건은 paid_at + 희망배송일 기반으로 시뮬레이션
 * - DB 실제 단계가 더 앞서면 DB를 우선 (max DB, Simulation)
 */
export function resolveShopCustomerDisplayStage(
  order: {
    status: string;
    payment_status?: string | null;
    paid_at?: string | null;
    created_at?: string | null;
    desired_delivery_date?: string | null;
  },
  now = new Date()
):
  | { kind: "stage"; stage: ShopFulfillmentStageKey }
  | { kind: "pending" }
  | { kind: "cancelled" }
  | { kind: "unknown" } {
  const db = resolveShopFulfillmentStage(order);
  if (db.kind !== "stage") return db;
  if (!isPaid(order)) return db;

  const paidAt = parseDateLike(order.paid_at) ?? parseDateLike(order.created_at);
  if (!paidAt) return db;

  const elapsedMs = Math.max(0, now.getTime() - paidAt.getTime());
  const simulationStage = resolveSimulationStageByElapsed(elapsedMs);
  const completeAt = resolveDisplayCompleteAt(paidAt, order.desired_delivery_date);
  const canShowComplete =
    elapsedMs >= COMPLETE_MIN_ELAPSED_MS && now.getTime() >= completeAt.getTime();
  const simulationFinal = canShowComplete ? "complete" : simulationStage;
  const merged = laterStage(db.stage, simulationFinal);
  return { kind: "stage", stage: merged };
}

/** 목록·탭용 뱃지 (취소/미결제/알 수 없음 포함) */
export function shopOrderCustomerBadge(order: {
  status: string;
  payment_status?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  desired_delivery_date?: string | null;
}): { label: string; background: string; color: string } {
  const r = resolveShopCustomerDisplayStage(order);
  if (r.kind === "cancelled") {
    return { label: "취소됨", ...SHOP_CANCELLED_BADGE };
  }
  if (r.kind === "pending") {
    return { label: "결제 대기", ...SHOP_PENDING_PAYMENT_BADGE };
  }
  if (r.kind === "unknown") {
    return { label: "처리 중", background: "#E0F2FE", color: "#0284C7" };
  }
  const tab = SHOP_ORDER_FULFILLMENT_TABS.find((t) => t.key === r.stage)!;
  const style = SHOP_FULFILLMENT_BADGE[r.stage];
  return { label: tab.label, ...style };
}

/** Stepper 활성 스텝 인덱스 0..3. 미결제는 -1 */
export function shopOrderProgressStepIndex(order: {
  status: string;
  payment_status?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  desired_delivery_date?: string | null;
}): number {
  const r = resolveShopCustomerDisplayStage(order);
  if (r.kind !== "stage") return -1;
  switch (r.stage) {
    case "payment_done":
      return 0;
    case "crafting":
      return 1;
    case "departure":
      return 2;
    case "complete":
      return 3;
    default:
      return -1;
  }
}
