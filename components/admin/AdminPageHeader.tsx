import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const headerCardClass =
  "rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-emerald-50/40 px-5 py-4 shadow-sm sm:px-6";

export type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  titleIcon: LucideIcon;
  description: ReactNode;
  /** 헤더 카드 오른쪽 (엑셀 다운로드 등) */
  rightSlot?: ReactNode;
  className?: string;
};

export function AdminPageHeader({
  eyebrow,
  title,
  titleIcon: TitleIcon,
  description,
  rightSlot,
  className,
}: AdminPageHeaderProps) {
  const inner = (
    <>
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
      <div className="mt-1.5 max-w-none text-xs leading-relaxed text-slate-600 sm:text-sm">
        {description}
      </div>
    </>
  );

  if (rightSlot) {
    return (
      <div
        className={cn(
          "mb-6 flex shrink-0 items-center justify-between gap-4",
          className,
        )}
      >
        <header className={cn(headerCardClass, "min-w-0 flex-1")}>{inner}</header>
        {rightSlot}
      </div>
    );
  }

  return (
    <header className={cn("mb-6 shrink-0", headerCardClass, className)}>
      {inner}
    </header>
  );
}
