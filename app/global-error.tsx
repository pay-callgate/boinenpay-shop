"use client";

import React, { useEffect } from "react";

/**
 * 루트 레이아웃까지 침범한 오류용 — html/body 필수.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="bg-slate-50">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">심각한 오류</h1>
          <p className="max-w-md text-sm text-slate-600">
            {process.env.NODE_ENV === "development"
              ? error.message || "알 수 없는 오류"
              : "앱을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
