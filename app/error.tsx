"use client";

import React, { useEffect } from "react";

/**
 * App Router 세그먼트 오류 경계 — 누락 시 개발 모드에서
 * "missing required error components, refreshing..." 만 보일 수 있음.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
      <h1 className="text-lg font-semibold text-slate-900">문제가 발생했습니다</h1>
      <p className="max-w-md text-sm text-slate-600">
        {process.env.NODE_ENV === "development"
          ? error.message || "알 수 없는 오류"
          : "페이지를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        다시 시도
      </button>
    </div>
  );
}
