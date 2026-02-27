import * as React from "react";

const variants: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  active: "bg-green-100 text-green-700",
  sold_out: "bg-red-100 text-red-700",
  draft: "bg-slate-100 text-slate-700",
  inactive: "bg-amber-100 text-amber-700",
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
