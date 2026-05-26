import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 어드민 상단 헤더 카드(주문 목록·매출 분석·주문 상세 등) 공통 톤 */
export const ADMIN_PAGE_HEADER_CARD_CLASS =
  "rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-emerald-50/40 px-5 py-4 shadow-sm sm:px-6 [@media(min-width:768px)_and_(max-height:860px)]:rounded-xl [@media(min-width:768px)_and_(max-height:860px)]:px-4 [@media(min-width:768px)_and_(max-height:860px)]:py-2 [@media(min-width:768px)_and_(max-height:620px)]:py-1.5";

const headerCardClass = ADMIN_PAGE_HEADER_CARD_CLASS;

export type AdminPageHeaderProps = {
  eyebrow: string;
  title: string;
  titleIcon: LucideIcon;
  description: ReactNode;
  /** 헤더 카드 오른쪽 (엑셀 다운로드 등) */
  rightSlot?: ReactNode;
  className?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  iconClassName?: string;
  descriptionClassName?: string;
};

export function AdminPageHeader({
  eyebrow,
  title,
  titleIcon: TitleIcon,
  description,
  rightSlot,
  className,
  eyebrowClassName,
  titleClassName,
  iconClassName,
  descriptionClassName,
}: AdminPageHeaderProps) {
  const inner = (
    <>
      <p className={cn("text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs [@media(min-width:768px)_and_(max-height:620px)]:hidden", eyebrowClassName)}>
        {eyebrow}
      </p>
      <h1 className={cn("mt-0.5 flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl [@media(min-width:768px)_and_(max-height:860px)]:mt-0 [@media(min-width:768px)_and_(max-height:860px)]:text-lg", titleClassName)}>
        <TitleIcon
          className={cn("h-6 w-6 shrink-0 text-emerald-600 sm:h-7 sm:w-7 [@media(min-width:768px)_and_(max-height:860px)]:h-5 [@media(min-width:768px)_and_(max-height:860px)]:w-5", iconClassName)}
          strokeWidth={1.75}
          aria-hidden
        />
        {title}
      </h1>
      <div className={cn("mt-1.5 max-w-none text-xs leading-relaxed text-slate-600 sm:text-sm [@media(min-width:768px)_and_(max-height:860px)]:hidden", descriptionClassName)}>
        {description}
      </div>
    </>
  );

  if (rightSlot) {
    return (
      <div
        className={cn(
          "mb-6 flex shrink-0 items-center justify-between gap-4 [@media(min-width:768px)_and_(max-height:860px)]:mb-2 [@media(min-width:768px)_and_(max-height:860px)]:gap-3",
          className,
        )}
      >
        <header className={cn(headerCardClass, "min-w-0 flex-1")}>{inner}</header>
        {rightSlot}
      </div>
    );
  }

  return (
    <header className={cn("mb-6 shrink-0 [@media(min-width:768px)_and_(max-height:860px)]:mb-2", headerCardClass, className)}>
      {inner}
    </header>
  );
}
