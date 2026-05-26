"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import {
  AdminDashboardBarChart,
  type DashboardBarPoint,
} from "@/components/admin/AdminDashboardBarChart";

/**
 * 매출 분석 — 화훼·꽃배달 전용몰 파트너 어드민
 * /admin/stats/sales
 */

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  dailyRevenue: Record<string, number>;
  /** YYYY-MM → 원 (결제완료), 최근 6개월 조회용. KPI 기간과 무관 */
  monthlyRevenueByYm?: Record<string, number>;
}

/** 최근 6개월(rolling) 캘린더 월 키 */
function getRolling6MonthYmKeys(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** 최근 6개월 라벨 + 금액(만 원) — 실제 매곱이 없을 때 차트 레이아웃용 샘플 */
const SAMPLE_MONTHLY_MANWON: readonly number[] = [14, 22, 18, 26, 21, 30];

const STATUS_LABELS: Record<string, string> = {
  received: "접수",
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비",
  shipping: "배송중",
  delivered: "배송완료",
  confirmed_purchase: "구매확정",
  cancelled: "취소",
  returned: "반품",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  refunded: "환불",
};

const PERIOD_OPTIONS = [
  { value: "week" as const, label: "7일", sub: "최근 일주일" },
  { value: "month" as const, label: "1개월", sub: "최근 한 달" },
  { value: "year" as const, label: "1년", sub: "최근 1년" },
];

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

export default function StatsSalesPage() {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  useEffect(() => {
    async function fetchPartnerId() {
      const res = await adminFetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) setPartnerId(String(result.data.id));
      }
    }
    fetchPartnerId();
  }, []);

  useEffect(() => {
    async function fetchStats() {
      if (!partnerId) return;
      setLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      if (period === "week") startDate.setDate(startDate.getDate() - 7);
      else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);
      else if (period === "year") startDate.setFullYear(startDate.getFullYear() - 1);

      const res = await adminFetch(
        `/api/orders/stats?partnerId=${encodeURIComponent(partnerId)}&startDate=${encodeURIComponent(startDate.toISOString())}&endDate=${encodeURIComponent(endDate.toISOString())}`
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats ?? null);
      } else setStats(null);
      setLoading(false);
    }
    fetchStats();
  }, [partnerId, period]);

  const paidOrderCount = stats?.byPaymentStatus?.paid ?? 0;
  const avgPaidTicket =
    paidOrderCount > 0 && stats ? Math.round(stats.totalRevenue / paidOrderCount) : 0;

  /** KPI 기간과 무관: API의 최근 6개월 월별 결제완료 매출 */
  const { monthlyChartBars, monthlyChartUsesSample } = useMemo(() => {
    if (!stats) {
      return { monthlyChartBars: [] as DashboardBarPoint[], monthlyChartUsesSample: false };
    }
    const keys = getRolling6MonthYmKeys();
    const refYear = new Date().getFullYear();
    const byYm = stats.monthlyRevenueByYm ?? {};
    const real = keys.map((ym) => {
      const revenue = byYm[ym] ?? 0;
      const [yStr, mStr] = ym.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const label =
        y === refYear ? `${m}월` : `${String(y).slice(2)}.${String(m).padStart(2, "0")}`;
      return { label, valueManwon: revenue / 10_000 };
    });
    const allZero = real.every((b) => b.valueManwon === 0);
    if (!allZero) {
      return {
        monthlyChartBars: real.map(({ label, valueManwon }) => ({ label, valueManwon })),
        monthlyChartUsesSample: false,
      };
    }
    return {
      monthlyChartBars: real.map((b, i) => ({
        label: b.label,
        valueManwon: SAMPLE_MONTHLY_MANWON[i] ?? SAMPLE_MONTHLY_MANWON[SAMPLE_MONTHLY_MANWON.length - 1],
      })),
      monthlyChartUsesSample: true,
    };
  }, [stats]);

  const statusBreakdown = useMemo(() => {
    if (!stats?.byStatus) return [];
    const entries = Object.entries(stats.byStatus)
      .map(([key, count]) => ({
        key,
        label: STATUS_LABELS[key] || key,
        count,
      }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
    const total = entries.reduce((s, e) => s + e.count, 0);
    return entries.map((e) => ({ ...e, pct: total > 0 ? (e.count / total) * 100 : 0 }));
  }, [stats?.byStatus]);

  const paymentBreakdown = useMemo(() => {
    if (!stats?.byPaymentStatus) return [];
    return Object.entries(stats.byPaymentStatus)
      .map(([key, count]) => ({
        key,
        label: PAYMENT_LABELS[key] || key,
        count,
      }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [stats?.byPaymentStatus]);

  if (!partnerId) {
    return (
      <div className="flex min-h-[48vh] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-6 py-16 shadow-sm">
        <div className="h-10 w-10 animate-pulse rounded-full bg-emerald-100" />
        <p className="mt-4 text-sm font-medium text-slate-600">매장 정보를 연결하는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 [@media(min-width:768px)_and_(max-height:860px)]:space-y-2">
      {/* 상단 헤더 */}
      <header className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-emerald-50/40 px-5 py-4 shadow-sm sm:px-6 [@media(min-width:768px)_and_(max-height:860px)]:rounded-xl [@media(min-width:768px)_and_(max-height:860px)]:px-4 [@media(min-width:768px)_and_(max-height:860px)]:py-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [@media(min-width:768px)_and_(max-height:860px)]:gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
              Sales · Analytics
            </p>
            <h1 className="mt-0.5 flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl [@media(min-width:768px)_and_(max-height:860px)]:text-lg">
              <BarChart3 className="h-6 w-6 text-emerald-600 sm:h-7 sm:w-7 [@media(min-width:768px)_and_(max-height:860px)]:h-5 [@media(min-width:768px)_and_(max-height:860px)]:w-5" strokeWidth={1.75} aria-hidden />
              매출 분석
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm [@media(min-width:768px)_and_(max-height:860px)]:hidden">
              화환·꽃배달 주문의 결제완료 기준 매출과 월별 추이, 배송·접수 상태를 한눈에 확인합니다.
            </p>
          </div>
          <div
            className="flex shrink-0 flex-wrap gap-1 rounded-xl border border-slate-200/90 bg-white/90 p-1 shadow-sm"
            role="tablist"
            aria-label="조회 기간"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={period === opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-left transition-all sm:min-w-[5rem] sm:px-3.5 sm:py-2 [@media(min-width:768px)_and_(max-height:860px)]:py-1 ${
                  period === opt.value
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span
                  className={`mt-0.5 block text-[11px] font-normal ${
                    period === opt.value ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-100 bg-slate-100/80"
            />
          ))}
        </div>
      ) : !stats ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-6 py-10 text-center text-sm text-amber-900">
          통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      ) : (
        <>
          {/* KPI 카드 */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [@media(min-width:768px)_and_(max-height:860px)]:gap-2" aria-label="요약 지표">
            <article className="group rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 sm:text-xs">기간 내 주문 건수</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:mt-1.5 sm:text-3xl">
                    {formatKrw(stats.totalOrders)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">접수·진행·완료·취소 포함 전체</p>
                </div>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600 group-hover:bg-slate-200/80 sm:p-2.5">
                  <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                </span>
              </div>
            </article>

            <article className="group rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/60 p-5 shadow-sm transition-shadow hover:shadow-md [@media(min-width:768px)_and_(max-height:860px)]:p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-emerald-800/80">결제완료 매출</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-700">
                    {formatKrw(stats.totalRevenue)}
                    <span className="text-lg font-semibold">원</span>
                  </p>
                  <p className="mt-1 text-xs text-emerald-900/60">PG 기준 유효 매출</p>
                </div>
                <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                  <Wallet className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </article>

            <article className="group rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 sm:text-xs">결제완료 주문 수</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:mt-1.5 sm:text-3xl">
                    {formatKrw(paidOrderCount)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">평균 객단가 계산에 사용</p>
                </div>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600 sm:p-2.5">
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                </span>
              </div>
            </article>

            <article className="group rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-shadow hover:shadow-md sm:p-4 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 sm:text-xs">평균 객단가 (결제완료)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:mt-1.5 sm:text-3xl">
                    {paidOrderCount > 0 ? `${formatKrw(avgPaidTicket)}` : "—"}
                    {paidOrderCount > 0 ? (
                      <span className="text-base font-semibold sm:text-lg">원</span>
                    ) : (
                      <span className="text-base font-normal text-slate-400 sm:text-lg"> </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 sm:text-xs">
                    <TrendingUp className="h-3 w-3 shrink-0 text-emerald-600 sm:h-3.5 sm:w-3.5" aria-hidden />
                    꽃·화환 주문 단가 추적
                  </p>
                </div>
                <span className="rounded-lg bg-slate-100 p-2 text-slate-600 sm:p-2.5">
                  <CalendarRange className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                </span>
              </div>
            </article>
          </section>

          <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
            {/* 주문 상태 비중 */}
            <section
              className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm"
              aria-labelledby="status-heading"
            >
              <h2 id="status-heading" className="text-sm font-bold text-slate-900 sm:text-base">
                주문·배송 단계 분포
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
                기간 내 전체 주문 대비 상태 비율 (꽃·화환 배송 프로세스)
              </p>
              {statusBreakdown.length === 0 ? (
                <p className="mt-5 py-4 text-center text-xs text-slate-500 sm:text-sm">표시할 데이터가 없습니다.</p>
              ) : (
                <>
                  <div className="mt-3 mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100 sm:mb-4">
                    {statusBreakdown.map((s, i) => {
                      const hues = [
                        "bg-slate-500",
                        "bg-emerald-500",
                        "bg-teal-500",
                        "bg-cyan-500",
                        "bg-amber-500",
                        "bg-orange-400",
                        "bg-rose-400",
                        "bg-red-400",
                      ];
                      return (
                        <div
                          key={s.key}
                          className={`${hues[i % hues.length]} transition-all`}
                          style={{ width: `${s.pct}%` }}
                          title={`${s.label} ${s.pct.toFixed(0)}%`}
                        />
                      );
                    })}
                  </div>
                  <ul className="space-y-2">
                    {statusBreakdown.map((s, i) => {
                      const hues = [
                        "bg-slate-500",
                        "bg-emerald-500",
                        "bg-teal-500",
                        "bg-cyan-500",
                        "bg-amber-500",
                        "bg-orange-400",
                        "bg-rose-400",
                        "bg-red-400",
                      ];
                      return (
                        <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 text-slate-700">
                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${hues[i % hues.length]}`} />
                            {s.label}
                          </span>
                          <span className="tabular-nums text-slate-900">
                            <strong>{s.count}</strong>
                            <span className="text-slate-400"> · </span>
                            {s.pct.toFixed(1)}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            {/* 결제 상태 */}
            <section
              className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm"
              aria-labelledby="payment-heading"
            >
              <h2 id="payment-heading" className="text-sm font-bold text-slate-900 sm:text-base">
                결제 상태
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">카드·PG 처리 기준 건수</p>
              {paymentBreakdown.length === 0 ? (
                <p className="mt-5 py-4 text-center text-xs text-slate-500 sm:text-sm">표시할 데이터가 없습니다.</p>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {paymentBreakdown.map((p) => (
                    <li
                      key={p.key}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 sm:px-3.5 sm:py-2.5"
                    >
                      <span className="text-xs font-medium text-slate-700 sm:text-sm">{p.label}</span>
                      <span className="text-base font-bold tabular-nums text-slate-900 sm:text-lg">{p.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* 월별 매출 — 최근 6개월, KPI 기간 필터와 무관 */}
          <AdminDashboardBarChart
            variant="emerald"
            title="월별 매출 추이"
            bars={monthlyChartBars}
            description={
              monthlyChartUsesSample
                ? "예시 막대(만 원) · 해당 기간 월별 결제완료 매출이 없을 때 표시"
                : "결제완료 주문만 집계 · 최근 6개월"
            }
            compact
            minHeightClass="min-h-[420px] sm:min-h-[460px] [@media(min-width:768px)_and_(max-height:860px)]:min-h-[300px]"
          />
        </>
      )}
    </div>
  );
}
