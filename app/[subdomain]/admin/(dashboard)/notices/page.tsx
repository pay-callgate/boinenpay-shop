"use client";

import { useParams } from "next/navigation";

/**
 * 공지사항 페이지 (Placeholder)
 * 추후 구현 예정
 */
export default function NoticesPage() {
  const params = useParams();
  const subdomain = params?.subdomain as string;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-slate-800">공지사항</h1>
      <p className="mt-2 text-slate-600">
        파트너·거래처 대상 공지사항을 관리하는 기능입니다.
      </p>
      <div className="mt-6 rounded-md bg-slate-100 px-4 py-6 text-center text-slate-500">
        <p className="font-medium">준비 중입니다.</p>
        <p className="mt-1 text-sm">해당 기능은 추후 제공될 예정입니다.</p>
      </div>
    </div>
  );
}
