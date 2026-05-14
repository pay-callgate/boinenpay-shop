"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { Badge } from "@/components/ui/badge";
import { AlimtalkHistoryDetailModal } from "@/components/admin/AlimtalkHistoryDetailModal";
import {
  ADMIN_ALIMTALK_STATUS_LABEL,
  type AdminAlimtalkHistoryStatus,
  type AdminAlimtalkMessageRow,
} from "@/lib/admin-alimtalk-messages";

function statusBadgeVariant(
  s: AdminAlimtalkHistoryStatus
):
  | "alim_completed"
  | "alim_scheduled"
  | "alim_sending"
  | "alim_failed"
  | "alim_partial" {
  switch (s) {
    case "completed":
      return "alim_completed";
    case "scheduled":
      return "alim_scheduled";
    case "sending":
      return "alim_sending";
    case "failed":
      return "alim_failed";
    case "partial":
      return "alim_partial";
    default:
      return "alim_completed";
  }
}

function formatSentAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function defaultDateRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = (x: Date) =>
    `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  return { from: ymd(from), to: ymd(to) };
}

export default function AdminAlimtalkMessagesPage() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [status, setStatus] = useState<AdminAlimtalkHistoryStatus | "all">(
    "all"
  );
  const [searchQ, setSearchQ] = useState("");
  const [applied, setApplied] = useState({
    from: defaults.from,
    to: defaults.to,
    status: "all" as AdminAlimtalkHistoryStatus | "all",
    q: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminAlimtalkMessageRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [summary, setSummary] = useState({
    totalSuccessCount: 0,
    estimatedSettlementWon: 0,
    unitWon: 4,
  });

  const [detailRow, setDetailRow] = useState<AdminAlimtalkMessageRow | null>(
    null
  );
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        from: applied.from,
        to: applied.to,
        status: applied.status,
        q: applied.q,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await adminFetch(`/api/admin/messages?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || "조회에 실패했습니다.");
        setItems([]);
        return;
      }
      setItems(json.data?.items ?? []);
      setTotal(json.data?.total ?? 0);
      if (json.data?.summary) {
        setSummary({
          totalSuccessCount: json.data.summary.totalSuccessCount ?? 0,
          estimatedSettlementWon: json.data.summary.estimatedSettlementWon ?? 0,
          unitWon: json.data.summary.unitWon ?? 4,
        });
      }
    } catch {
      setError("네트워크 오류");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [applied, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setApplied({
      from: dateFrom,
      to: dateTo,
      status,
      q: searchQ.trim(),
    });
    setPage(1);
  };

  const handleExcelDownload = async () => {
    const qs = new URLSearchParams({
      from: applied.from,
      to: applied.to,
      status: applied.status,
      q: applied.q,
    });
    setExporting(true);
    try {
      const res = await adminFetch(
        `/api/admin/messages/export?${qs.toString()}`
      );
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `alimtalk_messages_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        alert("엑셀 다운로드에 실패했습니다.");
      }
    } catch (e) {
      console.error("Excel download error:", e);
      alert("엑셀 다운로드 중 오류가 발생했습니다.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {detailRow && (
        <AlimtalkHistoryDetailModal
          isOpen={!!detailRow}
          onClose={() => setDetailRow(null)}
          title={detailRow.title}
          body={detailRow.body}
          senderPhone={detailRow.senderPhone}
          receiverPhone={detailRow.recipientPhone}
          batchId={detailRow.batchId}
          listKind={detailRow.listKind}
        />
      )}

      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 p-6">
        <div className="mb-6 shrink-0 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              알림톡 발송 관리
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              콜게이트·우리부고 알림톡 발송 건별 내역과 건당 {summary.unitWon}원
              기준 예상 정산 금액을 확인합니다.
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              조회 결과 {total}건 · 성공 합계 {summary.totalSuccessCount}건
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleExcelDownload()}
            disabled={exporting}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {exporting ? "다운로드 중…" : "엑셀 다운로드"}
          </button>
        </div>

        <div className="mb-4 shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end"
          >
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  시작일
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  종료일
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                상태
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as AdminAlimtalkHistoryStatus | "all")
                }
                className="h-10 min-w-[8rem] rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                <option value="all">전체</option>
                <option value="completed">완료</option>
                <option value="scheduled">예약</option>
                <option value="sending">발송 중</option>
                <option value="failed">불가</option>
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                검색 (거래처명 · 수신자 · 수신번호)
              </label>
              <input
                type="text"
                placeholder="거래처명, 수신자 또는 수신번호..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-md bg-[#1e293b] px-5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
            >
              조회
            </button>
          </form>
        </div>

        <div className="mb-4 shrink-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            정산 요약 (검색 조건 기준)
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">
              {summary.estimatedSettlementWon.toLocaleString("ko-KR")}원
            </span>
            <span className="text-sm text-slate-600">
              = 성공 {summary.totalSuccessCount.toLocaleString("ko-KR")}건 ×{" "}
              {summary.unitWon}원
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            실제 청구는 콜게이트 정산 정책에 따릅니다.
          </p>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="scrollbar-thin max-h-[calc(100vh-380px)] min-h-0 flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]">
                <tr>
                  <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-slate-600">
                    발송일시
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">
                    거래처명(수신자)
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">
                    제목
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600">
                    내용
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-slate-600">
                    상태
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-slate-600">
                    총 건수
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-slate-600">
                    성공
                  </th>
                  <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-slate-600">
                    실패
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      불러오는 중…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 text-sm transition-colors hover:bg-slate-50/50"
                    >
                      <td className="whitespace-nowrap px-3 py-3 text-center text-slate-700">
                        {formatSentAt(row.sentAt)}
                      </td>
                      <td className="px-3 py-3 text-slate-800">
                        <span className="font-medium">{row.clientName}</span>
                        <span className="text-slate-500">
                          ({row.recipientName})
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-3 text-slate-700">
                        {row.title}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailRow(row)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
                        >
                          상세보기
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {ADMIN_ALIMTALK_STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-slate-700">
                        {row.totalCount}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-emerald-700">
                        {row.successCount}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums text-red-600">
                        {row.failCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && total > 0 && (
            <div className="flex shrink-0 flex-col items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
                <div
                  className="absolute top-0 h-full rounded-full bg-slate-600 transition-all duration-200"
                  style={{
                    width: `${100 / totalPages}%`,
                    left: `${((page - 1) / totalPages) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="맨 처음"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="이전"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <span className="min-w-[4rem] text-center text-sm font-medium text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="다음"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
                  aria-label="맨 끝"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="mt-0.5 text-blue-600">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
          <p className="text-sm text-blue-700">
            목록은 Supabase{" "}
            <code className="rounded bg-blue-100/80 px-1 text-xs">
              link_kakao_notifications
            </code>{" "}
            에서 조회합니다. 예약·발송 중 필터는 현재 스키마에 해당 상태가 없어 결과가 비어
            있을 수 있습니다.
          </p>
        </div>
      </div>
    </>
  );
}
