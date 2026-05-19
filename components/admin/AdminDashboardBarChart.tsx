"use client";

import React from "react";

const BRAND_BLUE = "#2B78C5";

export type DashboardBarPoint = {
  label: string;
  /** 매출 (만 원). 소수 허용 (원 단위 금액을 만 원으로 환산 시) */
  valueManwon: number;
};

export type AdminDashboardBarChartVariant = "blue" | "emerald";

type Props = {
  /** 막대 최대 높이 기준(만 원). 미지정 시 데이터 최대값 기준 */
  maxScaleManwon?: number;
  bars?: DashboardBarPoint[];
  /** 로딩 시 스켈레톤 */
  loading?: boolean;
  /** blue: 데모 대시보드 / emerald: 매출 분석 등 */
  variant?: AdminDashboardBarChartVariant;
  /** 차트 제목 */
  title?: string;
  /** 제목 아래 보조 설명 */
  description?: string;
  /** 한 화면 배치용 낮은 높이·패딩 */
  compact?: boolean;
  /** 카드 전체 최소 높이(Tailwind 클래스). 지정 시 compact 기본 min-h 대신 사용 */
  minHeightClass?: string;
};

function formatYAxisLabel(v: number): string {
  if (v === 0) return "0";
  if (v < 0.01) return v.toFixed(3);
  if (v < 1) return String(Math.round(v * 100) / 100);
  if (v < 10) return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10);
  return String(Math.round(v));
}

function formatManwonTooltip(v: number): string {
  if (v < 10 && v % 1 !== 0) {
    return v.toLocaleString("ko-KR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  }
  return Math.round(v).toLocaleString("ko-KR");
}

function computeYMax(
  maxData: number,
  maxScaleManwon: number | undefined
): number {
  const scale = Math.max(maxScaleManwon ?? maxData, maxData, 0);
  if (scale <= 0) return 1;
  if (scale < 0.1) return Math.ceil(scale * 100) / 100;
  if (scale < 1) return Math.ceil(scale * 10) / 10;
  if (scale < 10) return Math.ceil(scale);
  return Math.max(100, Math.ceil(scale / 50) * 50);
}

const THEME: Record<
  AdminDashboardBarChartVariant,
  {
    card: string;
    pulseCard: string;
    iconBg: string;
    iconStroke: string;
    badge: string;
    grid: string;
    bar: string;
    barShadow: string;
    barHover: string;
    tooltipAccent: string;
    skeletonBar: string;
  }
> = {
  blue: {
    card: "border-blue-100 bg-gradient-to-br from-white to-blue-50/50 shadow-lg shadow-blue-500/5",
    pulseCard: "border-blue-100 bg-gradient-to-br from-white to-blue-50/50 shadow-lg shadow-blue-500/5",
    iconBg: "bg-blue-100",
    iconStroke: BRAND_BLUE,
    badge: "bg-blue-600 shadow-sm shadow-blue-500/30",
    grid: "border-blue-200/70",
    bar: "bg-gradient-to-t from-[#2B78C5] to-cyan-400 shadow-md shadow-blue-500/30 hover:from-blue-600 hover:to-cyan-300 hover:shadow-lg hover:shadow-blue-500/50",
    barShadow: "",
    barHover: "hover:scale-105",
    tooltipAccent: "text-blue-300",
    skeletonBar: "bg-slate-200",
  },
  emerald: {
    card: "border-emerald-100/90 bg-gradient-to-br from-white to-emerald-50/50 shadow-lg shadow-emerald-500/5",
    pulseCard: "border-emerald-100/90 bg-gradient-to-br from-white to-emerald-50/50 shadow-lg shadow-emerald-500/5",
    iconBg: "bg-emerald-100",
    iconStroke: "#059669",
    badge: "bg-emerald-600 shadow-sm shadow-emerald-500/30",
    grid: "border-emerald-200/70",
    bar: "bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-300 hover:shadow-lg hover:shadow-emerald-400/40",
    barShadow: "",
    barHover: "hover:scale-105",
    tooltipAccent: "text-emerald-300",
    skeletonBar: "bg-slate-200",
  },
};

/**
 * 매출 세로 막대 차트 (단위: 만 원) — 일별·월별 등 공통
 */
export function AdminDashboardBarChart({
  bars,
  maxScaleManwon,
  loading,
  variant = "blue",
  title = "일별 매출 추이",
  description,
  compact = false,
  minHeightClass,
}: Props) {
  const list = bars ?? [];
  const theme = THEME[variant];
  const minH =
    minHeightClass ?? (compact ? "min-h-[220px]" : "min-h-[400px]");
  const pad = compact ? "p-4" : "p-6";
  const chartPad = compact ? "pb-6 pt-3" : "pb-8 pt-6";

  const maxData = list.length ? Math.max(...list.map((b) => b.valueManwon), 0) : 0;
  const yMax = computeYMax(maxData, maxScaleManwon);

  const n = 5;
  const ySteps = Array.from({ length: n + 1 }, (_, i) => {
    const raw = (yMax * (n - i)) / n;
    if (yMax < 1) return Math.round(raw * 100) / 100;
    if (yMax < 10) return Math.round(raw * 10) / 10;
    return Math.round(raw);
  });

  if (loading) {
    return (
      <div
        className={`col-span-2 flex ${minH} flex-col rounded-2xl border ${pad} shadow-lg animate-pulse ${theme.pulseCard}`}
      >
        <div className={`${compact ? "mb-3" : "mb-6"} h-8 w-48 rounded bg-slate-200`} />
        <div className={`flex flex-1 items-end gap-3 px-4 ${compact ? "pb-6" : "pb-8"}`}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
              <div
                className={`w-full max-w-[2rem] rounded-t-md ${theme.skeletonBar}`}
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
    <div
      className={`col-span-2 flex ${minH} flex-col rounded-2xl border ${pad} shadow-lg ${theme.card}`}
    >
      <div className={`mb-2 flex flex-col gap-2 ${compact ? "sm:mb-3" : "sm:mb-6"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3
            className={`flex items-center gap-2 font-bold text-slate-900 ${compact ? "text-base" : "text-lg"}`}
          >
            <div className={`rounded-lg ${compact ? "p-1.5" : "p-2"} ${theme.iconBg}`}>
              <svg
                className={compact ? "h-4 w-4" : "h-5 w-5"}
                style={{ color: theme.iconStroke }}
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
            {title}
          </h3>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${theme.badge}`}>
            단위: 만 원
          </span>
        </div>
        {description ? (
          <p
            className={`text-left text-xs leading-relaxed text-slate-500 ${compact ? "sm:pl-10" : "sm:pl-[3.25rem]"}`}
          >
            {description}
          </p>
        ) : null}
      </div>

      <div className={`relative flex min-h-0 flex-1 flex-col px-2 ${chartPad}`}>
        {/*
          X축 라벨을 플롯(flex-1) 밖의 별도 행에 둠.
          이전: 라벨을 막대 열 안에 넣으면 % 높이·중첩 flex·absolute 그리드와 같이 쓰일 때
          일부 환경에서 라벨이 플롯 상단으로 붙는 현상이 있었음.
        */}
        {/* 플롯: Y 그리드 + 막대만 */}
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-0 z-0 flex flex-col justify-between">
            {ySteps.map((step) => (
              <div key={step} className="relative flex w-full items-center">
                <span
                  className={`absolute -left-2 text-right text-[11px] font-semibold text-slate-500 ${compact ? "w-9" : "w-10"}`}
                >
                  {formatYAxisLabel(step)}
                </span>
                <div className={`${compact ? "ml-9" : "ml-10"} w-full border-t border-dashed ${theme.grid}`} />
              </div>
            ))}
          </div>

          <div
            className={`relative z-10 flex h-full min-h-0 items-end justify-between gap-1 px-1 sm:gap-2 sm:px-4 ${compact ? "ml-9" : "ml-10"}`}
          >
            {list.map((bar, i) => {
              const heightPercent = Math.min(100, (bar.valueManwon / yMax) * 100);
              return (
                <div
                  key={`${bar.label}-${i}`}
                  className="group flex h-full min-h-0 min-w-0 flex-1 flex-col justify-end items-center"
                >
                  <div
                    className={`relative w-5 cursor-pointer rounded-t-md transition-all duration-300 sm:w-7 ${theme.bar} ${theme.barHover}`}
                    style={{
                      height: `${Math.max(heightPercent, bar.valueManwon > 0 ? 4 : 0)}%`,
                    }}
                  >
                    <div className="absolute -top-11 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-xl group-hover:block">
                      <span className={theme.tooltipAccent}>매출:</span>{" "}
                      {formatManwonTooltip(bar.valueManwon)}만 원
                      <div className="absolute -bottom-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-slate-900" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* X축(월·일 등): 항상 플롯 하단 한 줄 */}
        <div
          className={`flex shrink-0 justify-between gap-1 px-1 pt-2 sm:gap-2 sm:px-4 ${compact ? "ml-9" : "ml-10"}`}
        >
          {list.map((bar, i) => (
            <span
              key={`${bar.label}-x-${i}`}
              className={`min-w-0 flex-1 text-center font-bold leading-tight text-slate-700 ${compact ? "text-[10px]" : "text-[10px] sm:text-xs"}`}
            >
              {bar.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
