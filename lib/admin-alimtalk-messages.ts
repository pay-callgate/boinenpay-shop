/**
 * 파트너 어드민 — 카카오 알림톡 발송 관리 (link_kakao_notifications 매핑 + 필터 유틸).
 */

export type AdminAlimtalkHistoryStatus =
  | "completed"
  | "scheduled"
  | "sending"
  | "failed"
  /** 대량 배치에서 성공·실패가 섞인 경우 */
  | "partial";

export type AdminAlimtalkListKind = "single" | "batch";

export interface AdminAlimtalkMessageRow {
  id: string;
  listKind: AdminAlimtalkListKind;
  /** 대량 발송 그룹 UUID (단건이면 null) */
  batchId: string | null;
  partnerId: string;
  sentAt: string;
  clientName: string;
  recipientName: string;
  recipientPhone: string;
  title: string;
  body: string;
  status: AdminAlimtalkHistoryStatus;
  totalCount: number;
  successCount: number;
  failCount: number;
  senderPhone: string;
}

export const ADMIN_ALIMTALK_UNIT_WON = 4;

/** 단건/대량 발송 API가 적재하는 행 — 목록·export select 컬럼과 동일하게 유지 */
export interface LinkKakaoNotificationDbRow {
  id: string;
  created_at: string;
  partner_id: string;
  client_id: string;
  phone_masked: string | null;
  callback_masked: string | null;
  provider_ok: boolean;
  resolved_msg_preview: string | null;
  batch_id?: string | null;
  recipient_name?: string | null;
}

export function mapLinkKakaoRowToAdminMessage(
  row: LinkKakaoNotificationDbRow,
  clientName: string
): AdminAlimtalkMessageRow {
  const status: AdminAlimtalkHistoryStatus = row.provider_ok
    ? "completed"
    : "failed";
  const body = row.resolved_msg_preview?.trim() || "(내용 없음)";
  const rname = (row.recipient_name ?? "").trim();
  return {
    id: row.id,
    listKind: "single",
    batchId: row.batch_id?.trim() ? row.batch_id : null,
    partnerId: row.partner_id,
    sentAt: row.created_at,
    clientName: clientName.trim() || "(거래처)",
    recipientName: rname || "-",
    recipientPhone: row.phone_masked ?? "",
    title: "고객사 Link 안내",
    body,
    status,
    totalCount: 1,
    successCount: row.provider_ok ? 1 : 0,
    failCount: row.provider_ok ? 0 : 1,
    senderPhone: row.callback_masked?.trim() || "-",
  };
}

/** 배치 대표 행의 수신자 요약: 첫 수신자 기준 "이름 외 N명" */
export function formatBatchRecipientLabel(
  firstRow: LinkKakaoNotificationDbRow,
  total: number
): string {
  const name = (firstRow.recipient_name ?? "").trim();
  const phone = (firstRow.phone_masked ?? "").trim();
  const primary = name || phone || "수신자";
  if (total <= 1) return primary;
  return `${primary} 외 ${total - 1}명`;
}

function deriveBatchListStatus(
  successCount: number,
  failCount: number
): AdminAlimtalkHistoryStatus {
  if (failCount === 0) return "completed";
  if (successCount === 0) return "failed";
  return "partial";
}

/** DB 행 + 거래처명 기준 검색 (배치 내 일치 여부 판별용) */
export function rawRowMatchesSearch(
  row: LinkKakaoNotificationDbRow,
  clientName: string,
  q: string
): boolean {
  const qq = q.trim().toLowerCase();
  if (!qq) return true;
  const digits = qq.replace(/\D/g, "");
  const rname = (row.recipient_name ?? "").trim().toLowerCase();
  return (
    clientName.toLowerCase().includes(qq) ||
    rname.includes(qq) ||
    (digits.length > 0 &&
      (row.phone_masked ?? "").replace(/\D/g, "").includes(digits))
  );
}

export function adminAlimtalkListItemMatchesStatus(
  row: AdminAlimtalkMessageRow,
  status: AdminAlimtalkHistoryStatus | "all"
): boolean {
  if (status === "all") return true;
  if (status === "scheduled" || status === "sending") return false;
  if (status === "completed") {
    return row.failCount === 0 && row.successCount > 0;
  }
  if (status === "failed") {
    return row.successCount === 0 && row.failCount > 0;
  }
  if (status === "partial") {
    return row.status === "partial";
  }
  return true;
}

/**
 * 원시 DB 행들을 배치 단위로 묶어 목록용 행 생성 (검색·그룹 통계 반영).
 * 검색어가 있으면, 배치는 구성원 중 하나라도 매칭될 때 전체 배치를 표시합니다.
 */
export function buildGroupedAdminListFromRawRows(
  rawRows: LinkKakaoNotificationDbRow[],
  nameById: Map<string, string>,
  q: string
): AdminAlimtalkMessageRow[] {
  const batchMap = new Map<string, LinkKakaoNotificationDbRow[]>();
  const singles: LinkKakaoNotificationDbRow[] = [];

  for (const row of rawRows) {
    const bid = row.batch_id?.trim();
    if (bid) {
      const arr = batchMap.get(bid) ?? [];
      arr.push(row);
      batchMap.set(bid, arr);
    } else {
      singles.push(row);
    }
  }

  const items: AdminAlimtalkMessageRow[] = [];

  for (const row of singles) {
    const cname = nameById.get(row.client_id) ?? "(거래처)";
    if (!rawRowMatchesSearch(row, cname, q)) continue;
    items.push(mapLinkKakaoRowToAdminMessage(row, cname));
  }

  for (const [, rows] of batchMap) {
    const sorted = [...rows].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const first = sorted[0];
    const clientName = nameById.get(first.client_id) ?? "(거래처)";
    const anyMatch = sorted.some((r) =>
      rawRowMatchesSearch(r, nameById.get(r.client_id) ?? "(거래처)", q)
    );
    if (!anyMatch) continue;

    const totalCount = sorted.length;
    const successCount = sorted.filter((r) => r.provider_ok).length;
    const failCount = totalCount - successCount;
    const status = deriveBatchListStatus(successCount, failCount);
    const sentAtRow = sorted.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b
    );
    const batchId = first.batch_id!.trim();

    items.push({
      id: `batch:${batchId}`,
      listKind: "batch",
      batchId,
      partnerId: first.partner_id,
      sentAt: sentAtRow.created_at,
      clientName,
      recipientName: formatBatchRecipientLabel(first, totalCount),
      recipientPhone: first.phone_masked ?? "",
      title: "고객사 Link 안내",
      body: first.resolved_msg_preview?.trim() || "(내용 없음)",
      status,
      totalCount,
      successCount,
      failCount,
      senderPhone: first.callback_masked?.trim() || "-",
    });
  }

  return items.sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );
}

/** YYYY-MM-DD 를 KST 일의 시작·끝을 UTC ISO 문자열로 (Supabase timestamptz 비교용) */
export function kstDayStartUtcIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+09:00`).toISOString();
}

export function kstDayEndUtcIso(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999+09:00`).toISOString();
}

export const ADMIN_ALIMTALK_STATUS_LABEL: Record<
  AdminAlimtalkHistoryStatus,
  string
> = {
  completed: "완료",
  scheduled: "예약",
  sending: "발송 중",
  failed: "불가",
  partial: "일부 실패",
};

/** 데모용 스텁 — API에서 세션의 partnerId로 덮어씀 */
export const ADMIN_ALIMTALK_MESSAGES_STUB: Omit<
  AdminAlimtalkMessageRow,
  "partnerId"
>[] = [
  {
    id: "stub-1",
    listKind: "single",
    batchId: null,
    sentAt: "2026-03-28T14:32:00+09:00",
    clientName: "플라워갤러리 강남점",
    recipientName: "이민정",
    recipientPhone: "01012345678",
    title: "고객사 Link 안내",
    body: `안녕하세요.

화면으로 바로 주문하는
플라워갤러리 강남점 콜링크 쇼핑입니다.

요청하신 서비스 이용을 위해 아래의 링크를 눌러 접속해 주세요.
https://example.com/wooribugo/flower-gangnam

감사합니다.`,
    status: "completed",
    totalCount: 1,
    successCount: 1,
    failCount: 0,
    senderPhone: "07012345678",
  },
  {
    id: "stub-2",
    listKind: "single",
    batchId: null,
    sentAt: "2026-03-29T09:15:00+09:00",
    clientName: "꽃마을 종로",
    recipientName: "박대리",
    recipientPhone: "01098765432",
    title: "고객사 Link 안내",
    body: `안녕하세요.

화면으로 바로 주문하는
꽃마을 종로 콜링크 쇼핑입니다.

요청하신 서비스 이용을 위해 아래의 링크를 눌러 접속해 주세요.
https://example.com/wooribugo/jongno

감사합니다.`,
    status: "scheduled",
    totalCount: 50,
    successCount: 0,
    failCount: 0,
    senderPhone: "07012345678",
  },
  {
    id: "stub-3",
    listKind: "single",
    batchId: null,
    sentAt: "2026-03-30T11:00:00+09:00",
    clientName: "로즈가든",
    recipientName: "김과장",
    recipientPhone: "01055551234",
    title: "고객사 Link 안내",
    body: "대량 발송 배치 처리 중입니다.",
    status: "sending",
    totalCount: 120,
    successCount: 80,
    failCount: 0,
    senderPhone: "07012345678",
  },
  {
    id: "stub-4",
    listKind: "single",
    batchId: null,
    sentAt: "2026-03-30T16:45:00+09:00",
    clientName: "스프링플라워",
    recipientName: "최팀장",
    recipientPhone: "01011112222",
    title: "고객사 Link 안내",
    body: "템플릿 불일치로 발송에 실패했습니다. (스텁)",
    status: "failed",
    totalCount: 1,
    successCount: 0,
    failCount: 1,
    senderPhone: "07012345678",
  },
];

export interface AdminAlimtalkFilterParams {
  fromIso: string | null;
  toIso: string | null;
  status: AdminAlimtalkHistoryStatus | "all";
  q: string;
}

function parseDayStart(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDayEnd(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function filterAdminAlimtalkRows(
  rows: AdminAlimtalkMessageRow[],
  p: AdminAlimtalkFilterParams
): AdminAlimtalkMessageRow[] {
  let out = rows;

  if (p.fromIso) {
    const from = parseDayStart(p.fromIso);
    out = out.filter((r) => new Date(r.sentAt) >= from);
  }
  if (p.toIso) {
    const to = parseDayEnd(p.toIso);
    out = out.filter((r) => new Date(r.sentAt) <= to);
  }
  if (p.status !== "all") {
    out = out.filter((r) => r.status === p.status);
  }
  const qq = p.q.trim().toLowerCase();
  if (qq) {
    out = out.filter(
      (r) =>
        r.clientName.toLowerCase().includes(qq) ||
        r.recipientName.toLowerCase().includes(qq) ||
        r.recipientPhone.replace(/\D/g, "").includes(qq.replace(/\D/g, ""))
    );
  }

  return out.sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );
}

export function summarizeAlimtalkSettlement(rows: AdminAlimtalkMessageRow[]): {
  totalSuccessCount: number;
  estimatedSettlementWon: number;
} {
  const totalSuccessCount = rows.reduce((s, r) => s + r.successCount, 0);
  return {
    totalSuccessCount,
    estimatedSettlementWon: totalSuccessCount * ADMIN_ALIMTALK_UNIT_WON,
  };
}
