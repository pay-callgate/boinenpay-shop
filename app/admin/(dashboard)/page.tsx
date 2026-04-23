"use client";

import React, { useMemo, useState } from "react";
import {
  AdminDashboardView,
  AdminDashboardKpiCard,
  DashboardKpiIcons,
  type DashboardPeriod,
} from "@/components/admin/AdminDashboardView";
import { AdminDashboardBarChart } from "@/components/admin/AdminDashboardBarChart";

/**
 * 파트너 어드민 대시보드 (Demo용 Mock UI)
 * /admin (중앙 집중형)
 */

const MOCK_DAILY_SALES = [
  { label: "월", valueManwon: 150 },
  { label: "화", valueManwon: 230 },
  { label: "수", valueManwon: 285 },
  { label: "목", valueManwon: 220 },
  { label: "금", valueManwon: 310 },
  { label: "토", valueManwon: 420 },
  { label: "일", valueManwon: 380 },
];

const MOCK_RECENT_ORDERS = [
  {
    no: "20260224-01",
    client: "기아자동차",
    amount: "155,000원",
    status: "배송중",
    statusColor: "bg-blue-50 text-blue-700",
    dotColor: "bg-blue-500",
  },
  {
    no: "20260224-02",
    client: "삼성전자",
    amount: "980,000원",
    status: "결제완료",
    statusColor: "bg-emerald-50 text-emerald-700",
    dotColor: "bg-emerald-500",
  },
  {
    no: "20260223-11",
    client: "LG전자",
    amount: "420,000원",
    status: "배송준비중",
    statusColor: "bg-violet-50 text-violet-700",
    dotColor: "bg-violet-500",
  },
  {
    no: "20260223-05",
    client: "현대자동차",
    amount: "65,000원",
    status: "입금대기",
    statusColor: "bg-amber-50 text-amber-700",
    dotColor: "bg-amber-500",
  },
  {
    no: "20260222-09",
    client: "네이버",
    amount: "1,250,000원",
    status: "결제완료",
    statusColor: "bg-emerald-50 text-emerald-700",
    dotColor: "bg-emerald-500",
  },
];

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  const chartBars = useMemo(() => {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      const dayName = dayNames[d.getDay()];
      return {
        label: `${month}.${date}(${dayName})`,
        valueManwon: MOCK_DAILY_SALES[i]?.valueManwon ?? 0,
      };
    });
  }, []);

  const kpis = (
    <>
      <AdminDashboardKpiCard
        title="오늘 매출"
        value="2,850,000원"
        icon={<DashboardKpiIcons.DollarSign className="h-6 w-6" />}
        subline={
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>어제 대비 +5.2%</span>
          </span>
        }
      />
      <AdminDashboardKpiCard
        title="오늘 주문"
        value="45건"
        icon={<DashboardKpiIcons.ShoppingCart className="h-6 w-6" />}
        subline={
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>어제 대비 +12건</span>
          </span>
        }
      />
      <AdminDashboardKpiCard
        title="신규 거래처"
        value="3건"
        icon={<DashboardKpiIcons.Package className="h-6 w-6" />}
        subline={
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>이번 주 +3곳 유입</span>
          </span>
        }
      />
      <AdminDashboardKpiCard
        title="문의"
        value="12건"
        icon={<DashboardKpiIcons.ClipboardList className="h-6 w-6" />}
        subline={
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>어제 대비 +4건</span>
          </span>
        }
      />
    </>
  );

  const recentOrders = (
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
          {MOCK_RECENT_ORDERS.map((order) => (
            <tr
              key={order.no}
              className="border-b border-slate-100 last:border-0"
            >
              <td className="py-2.5 text-xs text-slate-700">{order.no}</td>
              <td className="py-2.5 text-xs text-slate-700">{order.client}</td>
              <td className="py-2.5 text-right text-xs font-semibold text-slate-900">
                {order.amount}
              </td>
              <td className="py-2.5 text-center text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${order.statusColor}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${order.dotColor}`}
                  />
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AdminDashboardView
      title="대시보드"
      subtitle="실시간 주문·매출 현황처럼 보이는 데모용 요약 화면입니다."
      period={period}
      onPeriodChange={setPeriod}
      kpis={kpis}
      chart={
        <AdminDashboardBarChart bars={chartBars} maxScaleManwon={500} />
      }
      recentOrders={recentOrders}
    />
  );
}
