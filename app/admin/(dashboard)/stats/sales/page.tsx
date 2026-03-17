"use client";

import React, { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
/**
 * 매출 분석 페이지 (파트너 어드민)
 * /admin/stats/sales (중앙 집중형)
 * - 기간별 매출·주문 통계, 일별 매출 추이
 */

interface Stats {
  totalOrders: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  dailyRevenue: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "입금대기",
  paid: "결제완료",
  preparing: "배송준비중",
  shipping: "배송중",
  delivered: "배송완료",
  cancelled: "취소됨",
};

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
        if (result.success && result.data?.id) setPartnerId(result.data.id);
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
        `/api/orders/stats?partnerId=${partnerId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
      setLoading(false);
    }
    fetchStats();
  }, [partnerId, period]);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ko-KR").format(price);

  if (!partnerId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600"></p>
      </div>
    );
  }

  const periodLabels = [
    { value: "week" as const, label: "최근 7일" },
    { value: "month" as const, label: "최근 1개월" },
    { value: "year" as const, label: "최근 1년" },
  ];

  const dailyEntries = stats
    ? Object.entries(stats.dailyRevenue).sort(([a], [b]) => b.localeCompare(a)).slice(0, period === "year" ? 31 : 14)
    : [];
  const maxRevenue = dailyEntries.length
    ? Math.max(...dailyEntries.map(([, v]) => v))
    : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800">매출 분석</h1>
        <p className="mt-2 text-slate-600">
          기간별·주문 상태별 매출 통계와 일별 매출 추이를 확인합니다.
        </p>
        <div className="mt-4 flex gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-1">
          {periodLabels.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.value
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <div className="py-12 text-center text-slate-500">데이터를 불러오는 중...</div>
      ) : (
        <div className="p-6 space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">총 주문</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{stats.totalOrders}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">총 매출 (결제완료 기준)</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatPrice(stats.totalRevenue)}원
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">평균 주문 금액</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {stats.totalOrders > 0
                  ? `${formatPrice(Math.round(stats.totalRevenue / stats.totalOrders))}원`
                  : "0원"}
              </p>
            </div>
          </div>

          {/* 주문 상태별 */}
          <div className="rounded-lg border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-700 mb-4">주문 상태별 현황</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div
                  key={status}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <p className="text-xs font-medium text-slate-600">
                    {STATUS_LABELS[status] || status}
                  </p>
                  <p className="text-xl font-bold text-slate-800">{count}</p>
                </div>
              ))}
              {Object.keys(stats.byStatus).length === 0 && (
                <p className="col-span-full text-sm text-slate-500">데이터 없음</p>
              )}
            </div>
          </div>

          {/* 일별 매출 추이 */}
          <div className="rounded-lg border border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-700 mb-4">일별 매출 추이</h2>
            {dailyEntries.length === 0 ? (
              <p className="py-8 text-center text-slate-500">매출 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {dailyEntries.map(([date, revenue]) => {
                  const pct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={date} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm text-slate-600">
                        {date}
                      </span>
                      <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-28 text-right text-sm font-semibold text-slate-800">
                        {formatPrice(revenue)}원
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
