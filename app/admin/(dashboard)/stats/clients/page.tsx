"use client";

import React, { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
/**
 * 거래처별 분석 페이지 (파트너 어드민)
 * /admin/stats/clients (중앙 집중형)
 * - 거래처별 주문 건수·매출 통계
 */

interface ClientStat {
  clientId: string;
  clientName: string;
  orderCount: number;
  revenue: number;
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
        if (result.success && result.data?.id) setPartnerId(result.data.id);
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
        `/api/orders/stats/by-client?partnerId=${partnerId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setList(data.byClient || []);
      }
      setLoading(false);
    }
    fetchByClient();
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

  const totalOrders = list.reduce((s, c) => s + c.orderCount, 0);
  const totalRevenue = list.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-800">거래처별 분석</h1>
        <p className="mt-2 text-slate-600">
          거래처별 주문 건수와 매출 통계를 확인합니다.
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

      {loading ? (
        <div className="py-12 text-center text-slate-500">데이터를 불러오는 중...</div>
      ) : (
        <div className="p-6 space-y-6">
          {/* 합계 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">총 주문 건수</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{totalOrders}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase text-slate-500">총 매출</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatPrice(totalRevenue)}원
              </p>
            </div>
          </div>

          {/* 거래처별 테이블 */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">거래처</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">주문 건수</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">매출 (결제완료)</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">비율</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      해당 기간 주문 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  list.map((row) => {
                    const pct = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                    return (
                      <tr
                        key={row.clientId}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.clientName}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {row.orderCount}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {formatPrice(row.revenue)}원
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
