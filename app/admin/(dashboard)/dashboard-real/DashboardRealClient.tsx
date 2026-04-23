"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import {
  AdminDashboardView,
  AdminDashboardKpiCard,
  DashboardKpiIcons,
  type DashboardPeriod,
} from "@/components/admin/AdminDashboardView";
import { AdminDashboardBarChart } from "@/components/admin/AdminDashboardBarChart";
import { adminFetch } from "@/lib/admin-fetch";
import type { DashboardRealSummaryPayload } from "@/lib/admin-dashboard-real-data";
import type { DashboardBarPoint } from "@/components/admin/AdminDashboardBarChart";

function KpiSkeletonRow() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-2 h-3 w-20 rounded bg-slate-200" />
          <div className="h-8 w-28 rounded bg-slate-200" />
        </div>
      ))}
    </>
  );
}

function RealDashboardChartInner() {
  const [bars, setBars] = useState<DashboardBarPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch("/api/admin/dashboard-real/chart");
        const json = await res.json();
        if (cancelled) return;
        if (res.ok && json.ok && Array.isArray(json.data?.bars)) {
          setBars(json.data.bars);
        } else {
          setBars([]);
        }
      } catch {
        if (!cancelled) setBars([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bars) {
    return <AdminDashboardBarChart loading bars={[]} />;
  }

  const maxScaleManwon =
    bars.length > 0 ? Math.max(...bars.map((b) => b.valueManwon), 100) : 100;

  return (
    <AdminDashboardBarChart bars={bars} maxScaleManwon={maxScaleManwon} />
  );
}

/**
 * 차트만 Suspense로 분리 (청크 로딩 fallback). 데이터는 내부에서 추가 로딩.
 */
function RealDashboardChartSection() {
  return (
    <Suspense
      fallback={<AdminDashboardBarChart loading bars={[]} />}
    >
      <RealDashboardChartInner />
    </Suspense>
  );
}

export default function DashboardRealClient() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [summary, setSummary] = useState<DashboardRealSummaryPayload | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/dashboard-real");
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || "대시보드 데이터를 불러오지 못했습니다.");
        setSummary(null);
        return;
      }
      setSummary(json.data as DashboardRealSummaryPayload);
    } catch {
      setError("네트워크 오류");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const kpis = loading ? (
    <KpiSkeletonRow />
  ) : error ? (
    <div className="col-span-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {error}
    </div>
  ) : summary ? (
    <>
      <AdminDashboardKpiCard
        title="오늘 매출"
        value={`${summary.todayPaidTotalWon.toLocaleString("ko-KR")}원`}
        icon={<DashboardKpiIcons.DollarSign className="h-6 w-6" />}
        subline={<span>결제완료 · KST 당일 기준</span>}
      />
      <AdminDashboardKpiCard
        title="오늘 결제 건수"
        value={`${summary.todayPaidCount.toLocaleString("ko-KR")}건`}
        icon={<DashboardKpiIcons.ShoppingCart className="h-6 w-6" />}
        subline={<span>payment_status = paid</span>}
      />
      <AdminDashboardKpiCard
        title="뉴런 요주의"
        value={`${summary.urgentNewrunCount.toLocaleString("ko-KR")}건`}
        icon={<DashboardKpiIcons.Package className="h-6 w-6" />}
        subline={
          <span>
            미전송·실패·확인필요·pending·error (결제완료 주문)
          </span>
        }
      />
      <AdminDashboardKpiCard
        title="오늘 접수 주문"
        value={`${summary.todayAllOrdersCount.toLocaleString("ko-KR")}건`}
        icon={<DashboardKpiIcons.ClipboardList className="h-6 w-6" />}
        subline={<span>당일 생성 건수(전체)</span>}
      />
    </>
  ) : (
    <KpiSkeletonRow />
  );

  const recentTable =
    loading || !summary ? (
      <div className="space-y-2 animate-pulse py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-slate-100" />
        ))}
      </div>
    ) : (
      <div className="flex-1 overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 text-left font-medium">주문번호</th>
              <th className="py-2 text-left font-medium">거래처</th>
              <th className="py-2 text-right font-medium">금액</th>
              <th className="py-2 text-center font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {summary.recentOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-8 text-center text-slate-500"
                >
                  주문 내역이 없습니다.
                </td>
              </tr>
            ) : (
              summary.recentOrders.map((order) => (
                <tr
                  key={order.orderNo}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-2.5 text-xs text-slate-700">
                    {order.orderNo}
                  </td>
                  <td className="py-2.5 text-xs text-slate-700">
                    {order.clientName}
                  </td>
                  <td className="py-2.5 text-right text-xs font-semibold text-slate-900">
                    {order.amountWon.toLocaleString("ko-KR")}원
                  </td>
                  <td className="py-2.5 text-center text-xs">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${order.statusColor}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${order.dotColor}`}
                      />
                      {order.statusLabel}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );

  return (
    <AdminDashboardView
      title="대시보드(실운영)"
      subtitle="Supabase 주문·결제 데이터 기준 요약입니다. (오픈 전 검증용)"
      period={period}
      onPeriodChange={setPeriod}
      kpis={kpis}
      chart={<RealDashboardChartSection />}
      recentOrders={recentTable}
    />
  );
}
