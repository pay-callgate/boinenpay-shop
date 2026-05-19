"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export type AdminBoardComingSoonLayoutProps = {
  /** Sales · Analytics 스타일의 영문 라벨 */
  eyebrow: string;
  title: string;
  titleIcon: LucideIcon;
  /** 헤더 아래 설명 (본문과 동일 톤의 strong 허용) */
  description: ReactNode;
};

/**
 * 게시판/리뷰 등 — 매출·거래처 분석 페이지와 맞춘 상단 헤더 + 준비 중 카드
 */
export function AdminBoardComingSoonLayout({
  eyebrow,
  title,
  titleIcon: TitleIcon,
  description,
}: AdminBoardComingSoonLayoutProps) {
  return (
    <div className="space-y-3">
      <header className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-emerald-50/40 px-5 py-4 shadow-sm sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
            {eyebrow}
          </p>
          <h1 className="mt-0.5 flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            <TitleIcon
              className="h-6 w-6 shrink-0 text-emerald-600 sm:h-7 sm:w-7"
              strokeWidth={1.75}
              aria-hidden
            />
            {title}
          </h1>
          <div className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-600 sm:text-sm">
            {description}
          </div>
        </div>
      </header>

      <section
        className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-emerald-50/20 to-white px-6 py-12 shadow-sm sm:px-10 sm:py-16"
        aria-labelledby="board-coming-soon-title"
      >
        <div className="mx-auto max-w-md text-center">
          <div
            className="mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100/95 to-teal-50 text-emerald-700 shadow-sm ring-1 ring-emerald-100/90"
            aria-hidden
          >
            <Sparkles className="h-9 w-9" strokeWidth={1.5} />
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-emerald-700/85 sm:text-xs">
            Coming soon
          </p>
          <h2
            id="board-coming-soon-title"
            className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
          >
            준비중입니다
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            해당 기능은 추후 제공될 예정입니다
          </p>
        </div>
      </section>
    </div>
  );
}
