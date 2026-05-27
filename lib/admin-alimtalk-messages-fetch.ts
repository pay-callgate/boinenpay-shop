import type { SupabaseClient } from "@supabase/supabase-js";
import {
  kstDayEndUtcIso,
  kstDayStartUtcIso,
  mapLinkKakaoRowToAdminMessage,
  rawRowMatchesSearch,
  buildGroupedAdminListFromRawRows,
  adminAlimtalkListItemMatchesStatus,
  type AdminAlimtalkHistoryStatus,
  type AdminAlimtalkMessageRow,
  type LinkKakaoNotificationDbRow,
} from "@/lib/admin-alimtalk-messages";
import {
  LINK_KAKAO_NOTIFICATION_EXPORT_SELECT,
} from "@/lib/admin-alimtalk-export";
import {
  linkKakaoRowCountsAsDeliveredFailed,
  linkKakaoRowCountsAsDeliveredSuccess,
} from "@/lib/link-kakao-delivery-status";

/** 엑셀·정산용 raw 행 상한 (수신자 1행 = 1레코드) — 목록 raw 상한과 동일 권장 */
export const ADMIN_ALIMTALK_DB_CAP = 8000;

/** 목록 그룹화 전 DB에서 가져오는 raw 행 상한 (배치 분해 시 행 수 증가) */
export const ADMIN_ALIMTALK_LIST_RAW_CAP = 8000;

export const LINK_KAKAO_NOTIFICATION_LIST_SELECT =
  "id, created_at, partner_id, client_id, phone_masked, callback_masked, provider_ok, delivery_status, result_code, error_message, final_error_message, kakao_report_code, kakao_report_message, sms_report_code, sms_report_message, sms_report_success, resolved_msg_preview, batch_id, recipient_name";

export function parseAdminAlimtalkListStatus(
  v: string | null
): AdminAlimtalkHistoryStatus | "all" {
  if (
    v === "completed" ||
    v === "scheduled" ||
    v === "sending" ||
    v === "failed" ||
    v === "partial"
  ) {
    return v;
  }
  return "all";
}

export type FetchAdminAlimtalkParams = {
  from: string | null;
  to: string | null;
  status: AdminAlimtalkHistoryStatus | "all";
  q: string;
  /** 목록: 기본 ADMIN_ALIMTALK_LIST_RAW_CAP */
  limit?: number;
};

async function loadClientNameMap(
  supabase: SupabaseClient,
  rawRows: LinkKakaoNotificationDbRow[]
): Promise<Map<string, string>> {
  const clientIds = [...new Set(rawRows.map((r) => r.client_id))];
  const nameById = new Map<string, string>();
  if (clientIds.length === 0) return nameById;

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name")
    .in("id", clientIds);

  if (clientsError) {
    console.error("[loadClientNameMap] clients", clientsError);
  }
  for (const c of clients ?? []) {
    if (c?.id) nameById.set(c.id, (c.name as string) ?? "");
  }
  return nameById;
}

/**
 * 어드민 목록: batch_id 가 있으면 그룹으로 합쳐 1행으로 표시.
 * 상태 필터는 SQL이 아닌 합산된 행 기준(완료=전원 성공, 불가=전원 실패, 전체=일부 실패 포함).
 */
export async function fetchAdminAlimtalkGroupedListForPartner(
  supabase: SupabaseClient,
  partnerId: string,
  params: FetchAdminAlimtalkParams
): Promise<{
  rows: AdminAlimtalkMessageRow[];
  dbError: { message: string } | null;
}> {
  const { from, to, status, q, limit = ADMIN_ALIMTALK_LIST_RAW_CAP } = params;

  if (status === "scheduled" || status === "sending") {
    return { rows: [], dbError: null };
  }

  let dbQuery = supabase
    .from("link_kakao_notifications")
    .select(LINK_KAKAO_NOTIFICATION_LIST_SELECT)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from?.trim()) {
    dbQuery = dbQuery.gte("created_at", kstDayStartUtcIso(from.trim()));
  }
  if (to?.trim()) {
    dbQuery = dbQuery.lte("created_at", kstDayEndUtcIso(to.trim()));
  }

  const { data: logs, error: logsError } = await dbQuery;

  if (logsError) {
    return {
      rows: [],
      dbError: { message: logsError.message },
    };
  }

  const rawRows = (logs ?? []) as LinkKakaoNotificationDbRow[];
  const nameById = await loadClientNameMap(supabase, rawRows);

  const grouped = buildGroupedAdminListFromRawRows(rawRows, nameById, q);
  const filtered = grouped.filter((r) =>
    adminAlimtalkListItemMatchesStatus(r, status)
  );

  return { rows: filtered, dbError: null };
}

/**
 * 엑셀 다운로드: 그룹화 없이 수신자(로우) 단위.
 */
export type LinkKakaoNotificationExportDbRow = LinkKakaoNotificationDbRow & {
  cmid?: string | null;
  tran_id?: string | null;
};

/**
 * 엑셀 다운로드: 그룹화 없이 수신자(DB) 1행 = 1행.
 * 목록(배치 합산)과 건수가 다를 수 있음 — 엑셀은 정산·수신자 단위 raw.
 */
export async function fetchAdminAlimtalkRawExportRowsForPartner(
  supabase: SupabaseClient,
  partnerId: string,
  params: FetchAdminAlimtalkParams
): Promise<{
  rows: LinkKakaoNotificationExportDbRow[];
  dbError: { message: string } | null;
}> {
  const { from, to, status, q, limit = ADMIN_ALIMTALK_DB_CAP } = params;

  if (status === "scheduled") {
    return { rows: [], dbError: null };
  }

  let dbQuery = supabase
    .from("link_kakao_notifications")
    .select(LINK_KAKAO_NOTIFICATION_EXPORT_SELECT)
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from?.trim()) {
    dbQuery = dbQuery.gte("created_at", kstDayStartUtcIso(from.trim()));
  }
  if (to?.trim()) {
    dbQuery = dbQuery.lte("created_at", kstDayEndUtcIso(to.trim()));
  }
  const { data: logs, error: logsError } = await dbQuery;

  if (logsError) {
    return {
      rows: [],
      dbError: { message: logsError.message },
    };
  }

  const rawRows = (logs ?? []) as LinkKakaoNotificationExportDbRow[];
  const nameById = await loadClientNameMap(supabase, rawRows);
  const rows: LinkKakaoNotificationExportDbRow[] = [];

  for (const row of rawRows) {
    const cname = nameById.get(row.client_id) ?? "(거래처)";
    if (!rawRowMatchesSearch(row, cname, q)) continue;
    if (!exportRowMatchesStatusFilter(row, status)) continue;
    rows.push(row);
  }

  return { rows, dbError: null };
}

function exportRowMatchesStatusFilter(
  row: LinkKakaoNotificationDbRow,
  status: AdminAlimtalkHistoryStatus | "all"
): boolean {
  if (status === "all") return true;
  if (status === "completed") {
    return linkKakaoRowCountsAsDeliveredSuccess(row);
  }
  if (status === "failed") {
    return linkKakaoRowCountsAsDeliveredFailed(row);
  }
  if (status === "partial") {
    const ds = row.delivery_status?.trim();
    if (ds === "partial") return true;
    const kakao = row.kakao_report_code?.trim();
    return ds === "failed" && !!kakao && kakao !== "0";
  }
  if (status === "sending") {
    return row.delivery_status?.trim() === "pending";
  }
  return false;
}

/** 엑셀용: DB raw + 거래처명 */
export async function fetchAdminAlimtalkExcelRowsForPartner(
  supabase: SupabaseClient,
  partnerId: string,
  params: FetchAdminAlimtalkParams
): Promise<{
  rows: { db: LinkKakaoNotificationExportDbRow; clientName: string }[];
  dbError: { message: string } | null;
}> {
  const { rows, dbError } = await fetchAdminAlimtalkRawExportRowsForPartner(
    supabase,
    partnerId,
    params
  );
  if (dbError) return { rows: [], dbError };

  const nameById = await loadClientNameMap(supabase, rows);

  return {
    rows: rows.map((db) => ({
      db,
      clientName: nameById.get(db.client_id) ?? "(거래처)",
    })),
    dbError: null,
  };
}
