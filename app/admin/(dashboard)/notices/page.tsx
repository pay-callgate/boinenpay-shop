"use client";

import { Megaphone } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

/**
 * 공지사항 — 리스트 레이아웃 스캐폴드
 * /admin/notices
 */
export default function NoticesPage() {
  const notices: Array<{
    id: string;
    title: string;
    target: string;
    status: string;
    publishedAt: string;
    updatedAt: string;
  }> = [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-4 py-4 sm:p-6">
      <div className="shrink-0">
        <AdminPageHeader
          eyebrow="Board · Notices"
          title="공지사항"
          titleIcon={Megaphone}
          description="파트너와 거래처(전용몰)에 전달할 공지를 등록하고 관리합니다."
        />

        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="공지 제목 검색..."
              disabled
              className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-400 sm:min-w-[220px] sm:flex-initial"
              aria-label="공지 검색"
            />
            <button
              type="button"
              disabled
              className="h-10 shrink-0 rounded-md border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-400"
            >
              검색
            </button>
            <button
              type="button"
              disabled
              className="ml-auto h-10 shrink-0 rounded-md bg-slate-200 px-4 text-sm font-medium text-slate-400"
            >
              + 공지 등록
            </button>
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">총 {notices.length}개 공지</p>
      </div>

      <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="scrollbar-thin flex-1 overflow-y-auto pb-4 md:hidden">
          <div className="space-y-3 p-3">
            {notices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-700">등록된 공지사항이 없습니다.</p>
                <p className="mt-1 text-xs text-slate-500">
                  공지 등록 기능이 연결되면 이곳에 카드 형태로 표시됩니다.
                </p>
              </div>
            ) : (
              notices.map((notice) => (
                <article key={notice.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-bold text-slate-900">{notice.title}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {notice.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{notice.target}</p>
                  <p className="mt-3 text-xs text-slate-600">
                    게시 {notice.publishedAt} · 수정 {notice.updatedAt}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="scrollbar-thin hidden min-h-0 flex-1 overflow-y-auto pb-4 md:flex md:flex-col">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">제목</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">대상</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">상태</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">게시일</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">수정일</th>
              </tr>
            </thead>
            <tbody>
              {notices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    등록된 공지사항이 없습니다.
                  </td>
                </tr>
              ) : (
                notices.map((notice) => (
                  <tr key={notice.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{notice.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{notice.target}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{notice.status}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{notice.publishedAt}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{notice.updatedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
