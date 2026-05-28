import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

/** 주문 상세 — 흰색 카드 + 좌측 핑크 포인트 타이틀 */
export function OrderDetailSectionCard({ title, children, className = "" }: Props) {
  return (
    <section className={`mb-4 rounded-2xl bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 flex items-center text-lg font-bold text-gray-900 before:mr-2 before:block before:h-4 before:w-1 before:rounded-full before:bg-pink-400 before:content-['']">
        {title}
      </h3>
      {children}
    </section>
  );
}
