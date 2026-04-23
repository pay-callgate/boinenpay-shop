"use client";

import React from "react";

const BRAND_BLUE = "#2B78C5";

export type DashboardBarPoint = {
  label: string;
  valueManwon: number;
};

type Props = {
  /** 막대 최대 높이 기준(만 원). 미지정 시 데이터 최대값 기준 */
  maxScaleManwon?: number;
  bars?: DashboardBarPoint[];
  /** 로딩 시 스켈레톤 */
  loading?: boolean;
};

/**
 * 데모 대시보드와 동일한 일별 매출 막대 차트 (단위: 만 원)
 */
export function AdminDashboardBarChart({
  bars,
  maxScaleManwon,
  loading,
}: Props) {
  const list = bars ?? [];
  const maxData = list.length
    ? Math.max(...list.map((b) => b.valueManwon), 0)
    : 0;
  const scale = Math.max(maxScaleManwon ?? maxData, maxData, 1);
  const yMax = Math.max(100, Math.ceil(scale / 50) * 50);
  const n = 5;
  const ySteps = Array.from({ length: n + 1 }, (_, i) =>
    Math.round((yMax * (n - i)) / n)
  );

  if (loading) {
    return (
      <div className="col-span-2 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-lg shadow-blue-500/5 flex flex-col min-h-[400px] animate-pulse">
        <div className="mb-6 h-8 w-48 rounded bg-slate-200" />
        <div className="flex flex-1 items-end gap-3 px-4 pb-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
              <div
                className="w-full max-w-[2rem] rounded-t-md bg-slate-200"
                style={{ height: `${20 + (i % 4) * 15}%` }}
              />
              <div className="h-3 w-12 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-2 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-lg shadow-blue-500/5 flex flex-col min-h-[400px]">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <div className="rounded-lg bg-blue-100 p-2">
            <svg
              className="h-5 w-5 text-[#2B78C5]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          일별 매출 추이
        </h3>
        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-blue-500/30">
          단위: 만 원
        </span>
      </div>

      <div className="relative flex flex-1 items-end px-2 pb-8 pt-6">
        <div className="absolute inset-0 z-0 flex flex-col justify-between pb-8 pt-6">
          {ySteps.map((step) => (
            <div key={step} className="relative flex w-full items-center">
              <span className="absolute -left-2 w-8 text-right text-[11px] font-semibold text-slate-500">
                {step}
              </span>
              <div className="ml-8 w-full border-t border-dashed border-blue-200/70" />
            </div>
          ))}
        </div>

        <div className="relative z-10 ml-8 flex h-full w-full items-end justify-between px-2 sm:px-6">
          {list.map((bar, i) => {
            const heightPercent = Math.min(100, (bar.valueManwon / yMax) * 100);
            return (
              <div
                key={`${bar.label}-${i}`}
                className="group relative flex h-full w-12 flex-col items-center justify-end sm:w-16"
              >
                <div
                  className="relative w-5 cursor-pointer rounded-t-md bg-gradient-to-t from-[#2B78C5] to-cyan-400 shadow-md shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:from-blue-600 hover:to-cyan-300 hover:shadow-lg hover:shadow-blue-500/50 sm:w-7"
                  style={{
                    height: `${Math.max(heightPercent, bar.valueManwon > 0 ? 4 : 0)}%`,
                  }}
                >
                  <div className="absolute -top-11 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-xl transition-all animate-fade-in-up group-hover:block">
                    <span className="text-blue-300">매출:</span>{" "}
                    {bar.valueManwon.toLocaleString("ko-KR")}만 원
                    <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-slate-900" />
                  </div>
                </div>
                <span className="absolute -bottom-7 whitespace-nowrap text-[11px] font-bold text-slate-700 sm:text-xs">
                  {bar.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
