import React, { Suspense } from "react";
import DashboardRealClient from "./DashboardRealClient";

/**
 * 실운영 DB 연동 대시보드 (오픈 시 /admin 메인으로 교체 예정)
 */
export default function DashboardRealPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen animate-pulse bg-slate-50 p-6">
          <div className="mb-6 h-8 max-w-md rounded bg-slate-200" />
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-slate-200"
              />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 min-h-[400px] rounded-2xl bg-slate-200" />
            <div className="min-h-[320px] rounded-2xl bg-slate-200" />
          </div>
        </div>
      }
    >
      <DashboardRealClient />
    </Suspense>
  );
}
