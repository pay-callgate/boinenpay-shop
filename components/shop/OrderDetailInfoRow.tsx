import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  valueBold?: boolean;
};

/** 주문 상세 — 아이콘 + 라벨 + 값 세로 리스트 행 */
export function OrderDetailInfoRow({ icon: Icon, label, children, valueBold }: Props) {
  return (
    <div className="flex gap-3 border-b border-pink-50 pb-5 last:border-b-0 last:pb-0 break-keep [word-break:keep-all]">
      <div
        className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500"
        aria-hidden
      >
        <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div
          className={`mt-1 text-sm leading-relaxed text-gray-900 ${
            valueBold ? "font-bold" : "font-medium"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
