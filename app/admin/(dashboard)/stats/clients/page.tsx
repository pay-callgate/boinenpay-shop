"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  Building2,
  Medal,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * 거래처별 분석 — 브랜드·전용몰(거래처) 매출 랭킹
 * /admin/stats/clients
 */

interface ClientStat {
  clientId: string;
  clientName: string;
  orderCount: number;
  revenue: number;
}

const PERIOD_OPTIONS = [
  { value: "week" as const, label: "7일", sub: "최근 일주일" },
  { value: "month" as const, label: "1개월", sub: "최근 한 달" },
  { value: "year" as const, label: "1년", sub: "최근 1년" },
];

function formatKrw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

function rankStyle(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-800 ring-1 ring-amber-200";
  if (rank === 2) return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  if (rank === 3) return "bg-orange-50 text-orange-900 ring-1 ring-orange-100";
  return "bg-slate-50 text-slate-600 ring-1 ring-slate-100";
}

export default function StatsClientsPage() {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [list, setList] = useState<ClientStat[]>([]);
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
    async function fetchByClient() {
      if (!partnerId) return;
      setLoading(true);
      const endDate = new Date();
      const startDate = new Date();
      if (period === "week") startDate.setDate(startDate.getDate() - 7);
      else if (period === "month") startDate.setMonth(startDate.getMonth() - 1);
      else if (period === "year") startDate.setFullYear(startDate.getFullYear() - 1);

      const res = await adminFetch(
        `/api/orders/stats/by-client?partnerId=${encodeURIComponent(partnerId)}&startDate=${encodeURIComponent(startDate.toISOString())}&endDate=${encodeURIComponent(endDate.toISOString())}`
      );
      if (res.ok) {
        const data = await res.json();
        setList(Array.isArray(data.byClient) ? data.byClient : []);
      } else setList([]);
      setLoading(false);
    }
    fetchByClient();
  }, [partnerId, period]);

  const totals = useMemo(() => {
    const totalOrders = list.reduce((s, c) => s + c.orderCount, 0);
    const totalRevenue = list.reduce((s, c) => s + c.revenue, 0);
    return { totalOrders, totalRevenue, clientCount: list.length };
  }, [list]);

  const topThree = list.slice(0, 3);

  if (!partnerId) {
    return (
      <div className="flex min-h-[48vh] flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-6 py-16 shadow-sm">
        <div className="h-10 w-10 animate-pulse rounded-full bg-teal-100" />
        <p className="mt-4 text-sm font-medium text-slate-600">매장 정보를 연결하는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-teal-50/35 px-6 py-7 shadow-sm sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800/80">
              Partner stores · Rankings
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              <Store className="h-8 w-8 text-teal-600" strokeWidth={1.75} aria-hidden />
              거래처별 분석
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              전용몰·거래처(브랜드)별 주문 건수와 결제완료 매출을 비교합니다.
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
                className={`rounded-lg px-3.5 py-2 text-left transition-all sm:min-w-[5.5rem] sm:px-4 ${
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
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80"
            />
          ))}
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3" aria-label="거래처 요약">
            <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">활성 거래처 수</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                    {totals.clientCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">기간 내 주문이 있는 몰</p>
                </div>
                <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">총 주문 건수</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                    {formatKrw(totals.totalOrders)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">전 거래처 합산</p>
                </div>
                <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
                  <ArrowDownWideNarrow className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </article>
            <article className="rounded-2xl border border-teal-200/70 bg-gradient-to-br from-white to-teal-50/50 p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-teal-900/70">총 매출 (결제완료)</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-teal-800">
                    {formatKrw(totals.totalRevenue)}
                    <span className="text-lg font-semibold">원</span>
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-teal-900/60">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    거래처 매출 합계
                  </p>
                </div>
                <span className="rounded-xl bg-teal-100 p-2.5 text-teal-700">
                  <Wallet className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </article>
          </section>

          {topThree.length > 0 && (
            <section aria-label="상위 거래처">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Medal className="h-4 w-4 text-amber-600" aria-hidden />
                매출 상위 거래처
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {topThree.map((row, idx) => {
                  const rank = idx + 1;
                  const share =
                    totals.totalRevenue > 0 ? (row.revenue / totals.totalRevenue) * 100 : 0;
                  return (
                    <article
                      key={row.clientId}
                      className={`rounded-2xl px-5 py-4 ${rankStyle(rank)}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide">
                          {rank}위
                        </span>
                        <span className="text-xs font-medium tabular-nums opacity-80">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                      <p className="mt-2 truncate text-base font-bold text-slate-900">
                        {row.clientName}
                      </p>
                      <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">
                        {formatKrw(row.revenue)}원
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">주문 {row.orderCount}건</p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section
            className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm"
            aria-labelledby="table-heading"
          >
            <div className="border-b border-slate-100 bg-slate-50/90 px-6 py-4">
              <h2 id="table-heading" className="text-base font-bold text-slate-900">
                거래처별 상세
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                매출 기준 내림차순 · 결제완료 금액만 집계
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-6 py-3">순위</th>
                    <th className="px-4 py-3">거래처</th>
                    <th className="px-4 py-3 text-right">주문</th>
                    <th className="px-4 py-3 text-right">매출</th>
                    <th className="min-w-[160px] px-4 py-3">매출 비중</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <p className="text-sm font-medium text-slate-600">해당 기간에 집계된 데이터가 없습니다.</p>
                        <p className="mt-1 text-xs text-slate-400">
                          전용몰 주문이 생기면 이곳에 거래처별 실적이 표시됩니다.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    list.map((row, idx) => {
                      const rank = idx + 1;
                      const share =
                        totals.totalRevenue > 0 ? (row.revenue / totals.totalRevenue) * 100 : 0;
                      return (
                        <tr
                          key={row.clientId}
                          className="border-b border-slate-50 transition-colors hover:bg-slate-50/80"
                        >
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg text-xs font-bold ${rankStyle(rank)}`}
                            >
                              {rank}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-semibold text-slate-900">{row.clientName}</span>
                          </td>
                          <td className="px-4 py-4 text-right tabular-nums text-slate-700">
                            {formatKrw(row.orderCount)}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-900">
                            {formatKrw(row.revenue)}원
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500"
                                  style={{ width: `${Math.min(100, Math.max(share, row.revenue > 0 ? 3 : 0))}%` }}
                                />
                              </div>
                              <span className="w-11 shrink-0 text-right text-xs font-medium tabular-nums text-slate-600">
                                {share.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
