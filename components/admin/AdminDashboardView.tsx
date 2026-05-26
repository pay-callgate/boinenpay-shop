"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  ArrowRight,
  ClipboardList,
  DollarSign,
  Package,
  ShoppingCart,
} from "lucide-react";

export type DashboardPeriod = "week" | "month" | "year";

export type AdminDashboardViewProps = {
  title: string;
  subtitle: string;
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  /** 상단 KPI 4칸 */
  kpis: React.ReactNode;
  /** 좌측 넓은 영역(차트) */
  chart: React.ReactNode;
  /** 우측 최근 주문 카드 내부 */
  recentOrders: React.ReactNode;
};

/**
 * 파트너 어드민 대시보드 공통 레이아웃 (데모·실운영 동일 껍데기)
 */
export function AdminDashboardView({
  title,
  subtitle,
  period,
  onPeriodChange,
  kpis,
  chart,
  recentOrders,
}: AdminDashboardViewProps) {
  const router = useRouter();
  const base = "/admin";
  const quickActions = [
    { label: "주문 관리", href: `${base}/orders`, primary: true },
    { label: "상품 관리", href: `${base}/products`, primary: false },
    { label: "거래처 관리", href: `${base}/clients`, primary: false },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between [@media(min-width:768px)_and_(max-height:860px)]:mb-3 [@media(min-width:768px)_and_(max-height:860px)]:gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-500 [@media(min-width:768px)_and_(max-height:860px)]:hidden">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
            {(
              [
                { value: "week" as const, label: "7일" },
                { value: "month" as const, label: "1개월" },
                { value: "year" as const, label: "1년" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPeriodChange(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors [@media(min-width:768px)_and_(max-height:860px)]:py-1 ${
                  period === opt.value
                    ? "bg-slate-800 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {quickActions.map((a) => (
              <button
                key={a.href}
                type="button"
                onClick={() => router.push(a.href)}
                className={`flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors [@media(min-width:768px)_and_(max-height:860px)]:h-8 [@media(min-width:768px)_and_(max-height:860px)]:px-3 [@media(min-width:768px)_and_(max-height:860px)]:text-xs ${
                  a.primary
                    ? "border-slate-800 bg-slate-800 text-white hover:bg-slate-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {a.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4 [@media(min-width:768px)_and_(max-height:860px)]:mb-3 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">{kpis}</div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3 [@media(min-width:768px)_and_(max-height:860px)]:mb-3 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
        {chart}

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm [@media(min-width:768px)_and_(max-height:860px)]:p-4">
          <div className="mb-3 flex items-center gap-2 [@media(min-width:768px)_and_(max-height:860px)]:mb-2">
            <CreditCard className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">
              최근 주문 목록
            </h2>
          </div>
          <p className="mb-3 text-xs text-slate-500 [@media(min-width:768px)_and_(max-height:860px)]:mb-2 [@media(min-width:768px)_and_(max-height:860px)]:line-clamp-1">
            최근 접수된 주문 흐름을 한눈에 확인할 수 있습니다.
          </p>
          {recentOrders}
          <button
            type="button"
            onClick={() => router.push(`${base}/orders`)}
            className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 [@media(min-width:768px)_and_(max-height:860px)]:mt-3 [@media(min-width:768px)_and_(max-height:860px)]:h-8"
          >
            전체 주문 보기
          </button>
        </div>
      </div>
    </div>
  );
}

/** KPI 카드 (데모·실운영 공통) */
export function AdminDashboardKpiCard(props: {
  title: string;
  value: string;
  icon: React.ReactNode;
  subline?: React.ReactNode;
}) {
  const { title, value, icon, subline } = props;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm [@media(min-width:768px)_and_(max-height:860px)]:p-3">
      <div className="absolute right-3 top-3 text-slate-200">{icon}</div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="text-2xl font-bold text-slate-900 [@media(min-width:768px)_and_(max-height:860px)]:text-xl">{value}</p>
      {subline ? (
        <div className="mt-1 text-xs font-medium text-slate-500">{subline}</div>
      ) : null}
    </div>
  );
}

export const DashboardKpiIcons = {
  DollarSign,
  ShoppingCart,
  Package,
  ClipboardList,
};
