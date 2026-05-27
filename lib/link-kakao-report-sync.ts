/**
 * link_kakao_notifications — 벤더 최종 리포트 동기화
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { kstDayEndUtcIso, kstDayStartUtcIso } from "@/lib/admin-alimtalk-messages";
import {
  buildDeliveryReportDbPatch,
  chunkCmids,
  deriveDeliveryOutcome,
  entriesByCmid,
  fetchGeneralReports,
  fetchKakaoReports,
  isReportApiNoDataYet,
  type MsgagentKakaoReportEntry,
} from "@/lib/msgagent-kakao-report";
import {
  logMsgagentReportSyncRow,
  logMsgagentReportSyncSummary,
} from "@/lib/msgagent-report-logger";

export const LINK_KAKAO_REPORT_SYNC_DEFAULT_LIMIT = 100;

export type LinkKakaoReportSyncRow = {
  id: string;
  cmid: string | null;
  phone_masked: string | null;
  delivery_status: string | null;
  provider_ok: boolean;
  kakao_report_code: string | null;
  sms_report_code: string | null;
  created_at: string;
};

export type LinkKakaoReportSyncResult = {
  scanned: number;
  updated: number;
  stillPending: number;
  skippedNoData: number;
  smsBackfillScanned: number;
  errors: string[];
};

function applyDateRange<T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(
  q: T,
  from?: string | null,
  to?: string | null
): T {
  let out = q;
  if (from?.trim()) {
    out = out.gte("created_at", kstDayStartUtcIso(from.trim()));
  }
  if (to?.trim()) {
    out = out.lte("created_at", kstDayEndUtcIso(to.trim()));
  }
  return out;
}

async function loadRowsForReportSync(
  supabase: SupabaseClient,
  partnerId: string,
  options: { limit: number; from?: string | null; to?: string | null }
): Promise<LinkKakaoReportSyncRow[]> {
  const half = Math.max(1, Math.ceil(options.limit / 2));

  let pendingQ = supabase
    .from("link_kakao_notifications")
    .select(
      "id, cmid, phone_masked, delivery_status, provider_ok, kakao_report_code, sms_report_code, created_at"
    )
    .eq("partner_id", partnerId)
    .eq("delivery_status", "pending")
    .eq("provider_ok", true)
    .not("cmid", "is", null)
    .order("created_at", { ascending: false })
    .limit(half);

  pendingQ = applyDateRange(pendingQ, options.from, options.to);

  let smsBackfillQ = supabase
    .from("link_kakao_notifications")
    .select(
      "id, cmid, phone_masked, delivery_status, provider_ok, kakao_report_code, sms_report_code, created_at"
    )
    .eq("partner_id", partnerId)
    .in("delivery_status", ["failed", "partial"])
    .not("cmid", "is", null)
    .not("kakao_report_code", "is", null)
    .neq("kakao_report_code", "0")
    .is("sms_report_code", null)
    .order("created_at", { ascending: false })
    .limit(half);

  smsBackfillQ = applyDateRange(smsBackfillQ, options.from, options.to);

  const [pendingRes, smsRes] = await Promise.all([pendingQ, smsBackfillQ]);

  if (pendingRes.error) throw new Error(pendingRes.error.message);
  if (smsRes.error) throw new Error(smsRes.error.message);

  const byId = new Map<string, LinkKakaoReportSyncRow>();
  for (const row of [...(pendingRes.data ?? []), ...(smsRes.data ?? [])]) {
    byId.set(row.id as string, row as LinkKakaoReportSyncRow);
  }

  return [...byId.values()].slice(0, options.limit);
}

function collectResendCmids(
  kakaoByCmid: Map<string, MsgagentKakaoReportEntry>
): string[] {
  const ids: string[] = [];
  for (const entry of kakaoByCmid.values()) {
    const rid = entry.resendMsgId?.trim();
    if (rid) ids.push(rid);
  }
  return ids;
}

export async function syncPendingLinkKakaoReportsForPartner(
  supabase: SupabaseClient,
  partnerId: string,
  options?: {
    limit?: number;
    from?: string | null;
    to?: string | null;
  }
): Promise<LinkKakaoReportSyncResult> {
  const limit = options?.limit ?? LINK_KAKAO_REPORT_SYNC_DEFAULT_LIMIT;
  const rows = await loadRowsForReportSync(supabase, partnerId, {
    limit,
    from: options?.from,
    to: options?.to,
  });

  const smsBackfillScanned = rows.filter(
    (r) =>
      r.delivery_status !== "pending" &&
      r.kakao_report_code &&
      String(r.kakao_report_code).trim() !== "0" &&
      !r.sms_report_code
  ).length;

  const result: LinkKakaoReportSyncResult = {
    scanned: rows.length,
    updated: 0,
    stillPending: 0,
    skippedNoData: 0,
    smsBackfillScanned,
    errors: [],
  };

  if (rows.length === 0) {
    logMsgagentReportSyncSummary({ partnerId, ...result });
    return result;
  }

  const cmids = rows
    .map((r) => (r.cmid != null ? String(r.cmid).trim() : ""))
    .filter(Boolean);

  const kakaoByCmid = new Map<string, MsgagentKakaoReportEntry>();

  for (const chunk of chunkCmids(cmids)) {
    try {
      const kakaoRes = await fetchKakaoReports(chunk);
      if (isReportApiNoDataYet(kakaoRes.apiResultCode)) {
        result.skippedNoData += chunk.length;
        continue;
      }
      if (
        kakaoRes.apiResultCode !== null &&
        kakaoRes.apiResultCode !== 0 &&
        kakaoRes.entries.length === 0
      ) {
        result.errors.push(
          `카카오 리포트 API result_code=${kakaoRes.apiResultCode}${kakaoRes.apiResultMessage ? `: ${kakaoRes.apiResultMessage}` : ""}`
        );
        continue;
      }
      for (const [id, entry] of entriesByCmid(kakaoRes.entries)) {
        kakaoByCmid.set(id, entry);
      }
    } catch (e) {
      result.errors.push(
        e instanceof Error ? e.message : `카카오 리포트 조회 실패: ${String(e)}`
      );
    }
  }

  const resendCmids = collectResendCmids(kakaoByCmid);
  const smsByCmid = new Map<string, MsgagentKakaoReportEntry>();

  for (const chunk of chunkCmids(resendCmids)) {
    try {
      const smsRes = await fetchGeneralReports(chunk);
      if (isReportApiNoDataYet(smsRes.apiResultCode)) continue;
      for (const [id, entry] of entriesByCmid(smsRes.entries)) {
        smsByCmid.set(id, entry);
      }
    } catch (e) {
      result.errors.push(
        e instanceof Error ? e.message : `문자 리포트 조회 실패: ${String(e)}`
      );
    }
  }

  for (const row of rows) {
    const cmid = row.cmid != null ? String(row.cmid).trim() : "";
    if (!cmid) {
      result.stillPending += 1;
      continue;
    }

    const kakao = kakaoByCmid.get(cmid) ?? null;
    if (!kakao || kakao.resultCode === null) {
      result.stillPending += 1;
      continue;
    }

    const resendId = kakao.resendMsgId?.trim();
    const sms = resendId ? smsByCmid.get(resendId) ?? null : null;
    const outcome = deriveDeliveryOutcome(kakao, sms);

    if (outcome.deliveryStatus === "pending") {
      result.stillPending += 1;
      continue;
    }

    const patch = buildDeliveryReportDbPatch(outcome, {
      kakao,
      sms: sms ?? undefined,
    });

    const { error: updErr } = await supabase
      .from("link_kakao_notifications")
      .update(patch)
      .eq("id", row.id)
      .eq("partner_id", partnerId);

    if (updErr) {
      result.errors.push(`DB 갱신 실패 id=${row.id}: ${updErr.message}`);
      result.stillPending += 1;
      continue;
    }

    result.updated += 1;

    logMsgagentReportSyncRow({
      notificationId: row.id,
      phoneMasked: row.phone_masked,
      cmid,
      deliveryStatus: outcome.deliveryStatus,
      kakaoCode: outcome.kakaoCode,
      kakaoMessage: outcome.kakaoMessage,
      smsCode: outcome.smsCode,
      smsMessage: outcome.smsMessage,
      resendMsgId: resendId ?? null,
    });
  }

  logMsgagentReportSyncSummary({ partnerId, ...result });

  return result;
}
