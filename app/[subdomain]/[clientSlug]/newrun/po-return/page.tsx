"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * 뉴런시스템(Newrun) 발주연동 rw_returnurl — 브라우저 리다이렉트 착지 (스텁)
 * 쿼리 예: rwr_result, rwr_sno, rwr_type, rwr_orderkey, 에러코드 등
 */
function PoReturnInner() {
  const searchParams = useSearchParams();
  const entries = Array.from(searchParams.entries());

  return (
    <div className="mx-auto min-h-[50vh] max-w-lg px-4 py-10">
      <p className="text-base font-medium text-gray-800">
        발주 처리 결과를 확인 중입니다...
      </p>
      <p className="mt-3 text-sm text-gray-600">
        뉴런시스템(Newrun)에서 전달된 파라미터입니다. (연동 확정 후 안내 메시지로 고도화 예정)
      </p>
      {entries.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">쿼리 파라미터가 없습니다.</p>
      ) : (
        <pre className="mt-8 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
          {entries.map(([k, v]) => `${k}=${v}`).join("\n")}
        </pre>
      )}
    </div>
  );
}

export default function NewrunPoReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-10 text-sm text-gray-600">
          발주 처리 결과를 확인 중입니다...
        </div>
      }
    >
      <PoReturnInner />
    </Suspense>
  );
}
