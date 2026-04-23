import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getKstYmd,
  kstDayStartUtcIso,
  kstDayYmdOffsetFromToday,
  kstTodayRangeUtc,
  dashboardRecentOrderStatusLabel,
  dashboardStatusBadgeStyle,
} from "@/lib/admin-dashboard-real";
import type { DashboardBarPoint } from "@/components/admin/AdminDashboardBarChart";

export type DashboardRealSummaryPayload = {
  todayPaidCount: number;
  todayPaidTotalWon: number;
  /** 결제완료 중 뉴런 미전송·실패·확인필요·pending·error */
  urgentNewrunCount: number;
  /** 오늘 00:00~23:59 KST 생성 주문(결제 여부 무관) */
  todayAllOrdersCount: number;
  recentOrders: {
    orderNo: string;
    clientName: string;
    amountWon: number;
    statusLabel: string;
    statusColor: string;
    dotColor: string;
  }[];
};

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchDashboardRealSummary(
  supabase: SupabaseClient,
  partnerId: string
): Promise<DashboardRealSummaryPayload> {
  const { startIso, endIso } = kstTodayRangeUtc();

  const { data: todayPaidRows, error: paidErr } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("partner_id", partnerId)
    .eq("payment_status", "paid")
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (paidErr) {
    console.error("[fetchDashboardRealSummary] today paid", paidErr);
  }

  const todayPaidCount = todayPaidRows?.length ?? 0;
  const todayPaidTotalWon = (todayPaidRows ?? []).reduce(
    (s, r) => s + num(r.total_amount),
    0
  );

  const { count: urgentNewrunCount, error: urgentErr } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("payment_status", "paid")
    .or(
      "newrun_submit_status.is.null,newrun_submit_status.eq.failed,newrun_submit_status.eq.skipped,newrun_submit_status.eq.pending,newrun_submit_status.eq.error"
    );

  if (urgentErr) {
    console.error("[fetchDashboardRealSummary] urgent newrun", urgentErr);
  }

  const { count: todayAllOrdersCount, error: allErr } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (allErr) {
    console.error("[fetchDashboardRealSummary] today all orders", allErr);
  }

  const { data: recent, error: recentErr } = await supabase
    .from("orders")
    .select(
      `
      order_no,
      total_amount,
      status,
      payment_status,
      created_at,
      client:clients ( name )
    `
    )
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (recentErr) {
    console.error("[fetchDashboardRealSummary] recent", recentErr);
  }

  const recentOrders = (recent ?? []).map((row) => {
    const st = String((row as { status?: string }).status ?? "");
    const pay = String((row as { payment_status?: string }).payment_status ?? "");
    const client = (row as { client?: { name?: string } | null }).client;
    const name = client?.name?.trim() || "—";
    const { statusColor, dotColor } = dashboardStatusBadgeStyle(st, pay);
    return {
      orderNo: String((row as { order_no?: string }).order_no ?? "—"),
      clientName: name,
      amountWon: num((row as { total_amount?: unknown }).total_amount),
      statusLabel: dashboardRecentOrderStatusLabel(st, pay),
      statusColor,
      dotColor,
    };
  });

  return {
    todayPaidCount,
    todayPaidTotalWon,
    urgentNewrunCount: urgentNewrunCount ?? 0,
    todayAllOrdersCount: todayAllOrdersCount ?? 0,
    recentOrders,
  };
}

export async function fetchDashboardRealChartBars(
  supabase: SupabaseClient,
  partnerId: string
): Promise<DashboardBarPoint[]> {
  const startYmd = kstDayYmdOffsetFromToday(-6);
  const startIso = kstDayStartUtcIso(startYmd);
  const endIso = kstTodayRangeUtc().endIso;

  const { data: rows, error } = await supabase
    .from("orders")
    .select("created_at, total_amount")
    .eq("partner_id", partnerId)
    .eq("payment_status", "paid")
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (error) {
    console.error("[fetchDashboardRealChartBars]", error);
    return buildEmptyWeekBars();
  }

  const buckets: Record<string, number> = {};
  for (const r of rows ?? []) {
    const iso = String((r as { created_at?: string }).created_at ?? "");
    const ymd = getKstYmd(new Date(iso));
    const amt = num((r as { total_amount?: unknown }).total_amount);
    buckets[ymd] = (buckets[ymd] ?? 0) + amt;
  }

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const bars: DashboardBarPoint[] = [];
  for (let i = 0; i <= 6; i++) {
    const ymd = kstDayYmdOffsetFromToday(-6 + i);
    const d = new Date(`${ymd}T12:00:00+09:00`);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    const dayName = dayNames[d.getDay()];
    const label = `${month}.${date}(${dayName})`;
    const won = buckets[ymd] ?? 0;
    bars.push({
      label,
      valueManwon: Math.round(won / 10000),
    });
  }
  return bars;
}

function buildEmptyWeekBars(): DashboardBarPoint[] {
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const out: DashboardBarPoint[] = [];
  for (let i = 0; i <= 6; i++) {
    const ymd = kstDayYmdOffsetFromToday(-6 + i);
    const d = new Date(`${ymd}T12:00:00+09:00`);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    const dayName = dayNames[d.getDay()];
    out.push({
      label: `${month}.${date}(${dayName})`,
      valueManwon: 0,
    });
  }
  return out;
}
