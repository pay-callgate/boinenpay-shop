import * as React from "react";

const variants: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  active: "bg-green-100 text-green-700",
  sold_out: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-700",
  inactive: "bg-amber-100 text-amber-700",
  /** 알림톡 발송 내역 */
  alim_completed: "bg-emerald-100 text-emerald-800",
  alim_scheduled: "bg-sky-100 text-sky-800",
  alim_sending: "bg-amber-100 text-amber-800",
  alim_failed: "bg-red-100 text-red-800",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
}
