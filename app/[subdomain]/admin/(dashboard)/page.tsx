"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package,
  DollarSign,
  ShoppingCart,
  BarChart3,
  ClipboardList,
  CreditCard,
  ArrowRight,
} from "lucide-react";

/**
 * 파트너 어드민 대시보드 (Demo용 Mock UI)
 * /[subdomain]/admin
 *
 * - 실제 API 연동 없이 하드코딩된 데이터로만 렌더링
 * - 투자자/시연용으로 "데이터가 꽉 찬" 느낌을 주는 대시보드
 */

const BRAND_BLUE = "#2B78C5";

const MOCK_DAILY_SALES = [
  { label: "월", value: 150 },
  { label: "화", value: 230 },
  { label: "수", value: 285 },
  { label: "목", value: 220 },
  { label: "금", value: 310 },
  { label: "토", value: 420 },
  { label: "일", value: 380 },
];

const MOCK_RECENT_ORDERS = [
  { no: "20260224-01", client: "기아자동차", amount: "155,000원", status: "배송중", statusColor: "bg-blue-50 text-blue-700", dotColor: "bg-blue-500" },
  { no: "20260224-02", client: "삼성전자", amount: "980,000원", status: "결제완료", statusColor: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
  { no: "20260223-11", client: "LG전자", amount: "420,000원", status: "배송준비중", statusColor: "bg-violet-50 text-violet-700", dotColor: "bg-violet-500" },
  { no: "20260223-05", client: "현대자동차", amount: "65,000원", status: "입금대기", statusColor: "bg-amber-50 text-amber-700", dotColor: "bg-amber-500" },
  { no: "20260222-09", client: "네이버", amount: "1,250,000원", status: "결제완료", statusColor: "bg-emerald-50 text-emerald-700", dotColor: "bg-emerald-500" },
];

export default function AdminDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = params?.subdomain as string;

  const [period, setPeriod] = useState<"week" | "month" | "year">("month");

  const base = `/${subdomain}/admin`;
  const quickActions = [
    { label: "주문 관리", href: `${base}/orders`, primary: true },
    { label: "상품 관리", href: `${base}/products`, primary: false },
    { label: "거래처 관리", href: `${base}/clients`, primary: false },
  ];

  const maxDailyValue = Math.max(...MOCK_DAILY_SALES.map((d) => d.value));
  const chartHeight = 160; // px
  const yTicks = [0, 100, 200, 300, 400];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* 헤더: 제목 좌측 / 기간 + 퀵액션 우측 */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">대시보드</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            실시간 주문·매출 현황처럼 보이는 데모용 요약 화면입니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex gap-0.5 p-0.5 bg-white border border-slate-200 rounded-lg shadow-sm">
            {[
              { value: "week" as const, label: "7일" },
              { value: "month" as const, label: "1개월" },
              { value: "year" as const, label: "1년" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                onClick={() => router.push(a.href)}
                className={`h-10 px-4 text-sm font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                  a.primary
                    ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-700"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {a.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top KPI 4개 — 오늘 매출/주문/신규 거래처/문의 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 relative overflow-hidden">
          <div className="absolute top-3 right-3 text-slate-200">
            <DollarSign className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            오늘 매출
          </p>
          <p className="text-2xl font-bold text-slate-900">2,850,000원</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>어제 대비 +5.2%</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 relative overflow-hidden">
          <div className="absolute top-3 right-3 text-slate-200">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            오늘 주문
          </p>
          <p className="text-2xl font-bold text-slate-900">45건</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>어제 대비 +12건</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 relative overflow-hidden">
          <div className="absolute top-3 right-3 text-slate-200">
            <Package className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            신규 거래처
          </p>
          <p className="text-2xl font-bold text-slate-900">3건</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>이번 주 +3곳 유입</span>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 relative overflow-hidden">
          <div className="absolute top-3 right-3 text-slate-200">
            <ClipboardList className="h-6 w-6" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            문의
          </p>
          <p className="text-2xl font-bold text-slate-900">12건</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-600">
            <span className="text-[10px]">▲</span>
            <span>어제 대비 +4건</span>
          </p>
        </div>
      </div>

      {/* 중앙 2단: 왼쪽 2/3 Bar Chart / 오른쪽 1/3 최근 주문 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 일별 매출 추이 (Vibrant SaaS Theme Mock Chart) */}
        <div className="col-span-2 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-lg shadow-blue-500/5 flex flex-col min-h-[400px]">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {/* 아이콘 색상을 더 밝고 생기있게 변경 */}
              <div className="rounded-lg bg-blue-100 p-2">
                <svg className="h-5 w-5 text-[#2B78C5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              일별 매출 추이
            </h3>
            {/* 단위 뱃지 색감 강화 */}
            <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-blue-500/30">
              단위: 만 원
            </span>
          </div>

          {/* 차트 영역 */}
          <div className="relative flex flex-1 items-end px-2 pb-8 pt-6">
            {/* Y축 그리드 배경 (Dashed Lines - 색상을 연한 파란색 톤으로 변경) */}
            <div className="absolute inset-0 z-0 flex flex-col justify-between pb-8 pt-6">
              {[500, 400, 300, 200, 100, 0].map((step) => (
                <div key={step} className="relative flex w-full items-center">
                  <span className="absolute -left-2 w-8 text-right text-[11px] font-semibold text-slate-500">
                    {step}
                  </span>
                  <div className="ml-8 w-full border-t border-dashed border-blue-200/70"></div>
                </div>
              ))}
            </div>

            {/* 막대 그래프 (Bars) */}
            <div className="relative z-10 ml-8 flex h-full w-full items-end justify-between px-2 sm:px-6">
              {Array.from({ length: 7 }).map((_, i) => {
                // 🚨 핵심 로직: 오늘 기준으로 7일 치 날짜 동적 계산 (왼쪽이 6일 전, 오른쪽 끝이 오늘)
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const month = String(d.getMonth() + 1).padStart(2, "0");
                const date = String(d.getDate()).padStart(2, "0");
                const dayName = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
                const label = `${month}.${date}(${dayName})`; // 예: 02.27(금)

                // 가상 데이터 매칭 (순서대로)
                const mockValues = [150, 230, 285, 220, 310, 420, 380];
                const value = mockValues[i];
                const heightPercent = (value / 500) * 100; // 최대값 500 기준

                return (
                  <div key={i} className="group relative flex h-full w-12 flex-col items-center justify-end sm:w-16">
                    {/* 막대 (w-5 sm:w-7) */}
                    <div
                      className="relative w-5 cursor-pointer rounded-t-md bg-gradient-to-t from-[#2B78C5] to-cyan-400 shadow-md shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:from-blue-600 hover:to-cyan-300 hover:shadow-lg hover:shadow-blue-500/50 sm:w-7"
                      style={{ height: `${heightPercent}%` }}
                    >
                      {/* 툴팁 (말풍선) */}
                      <div className="absolute -top-11 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block transition-all animate-fade-in-up z-20">
                        <span className="text-blue-300">매출:</span> {value.toLocaleString()}만 원
                        <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-slate-900"></div>
                      </div>
                    </div>

                    {/* X축 날짜 텍스트 (글자가 길어지므로 폰트 크기를 살짝 줄이고 줄바꿈 방지) */}
                    <span className="absolute -bottom-7 whitespace-nowrap text-[11px] font-bold text-slate-700 sm:text-xs">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 최근 주문 목록 — 1/3 Mock Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">최근 주문 목록</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            최근 접수된 주문 흐름을 한눈에 확인할 수 있습니다.
          </p>

          <div className="flex-1 overflow-hidden">
            <table className="w-full text-sm border-collapse">
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
                  <tr key={order.no} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 text-xs text-slate-700">{order.no}</td>
                    <td className="py-2.5 text-xs text-slate-700">{order.client}</td>
                    <td className="py-2.5 text-xs text-right text-slate-900 font-semibold">
                      {order.amount}
                    </td>
                    <td className="py-2.5 text-xs text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${order.statusColor}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${order.dotColor}`} />
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => router.push(`${base}/orders`)}
            className="mt-4 inline-flex items-center justify-center h-9 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            전체 주문 보기
          </button>
        </div>
      </div>
    </div>
  );
}
