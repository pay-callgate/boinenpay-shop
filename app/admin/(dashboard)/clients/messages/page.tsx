"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { AlimtalkHistoryDetailModal } from "@/components/admin/AlimtalkHistoryDetailModal";
import {
  type AdminAlimtalkHistoryStatus,
  type AdminAlimtalkMessageRow,
} from "@/lib/admin-alimtalk-messages";

/** `2026. 05. 11. 11:47` 형식 (대시보드 표기용) */
function formatSentAtDashboard(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}. ${m}. ${day}. ${h}:${min}`;
}

function formatDotDate(ymd: string): string {
  const [y, m, day] = ymd.split("-");
  if (!y || !m || !day) return ymd;
  return `${y}. ${m}. ${day}.`;
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
    totalFailCount: 0,
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
          totalFailCount: json.data.summary.totalFailCount ?? 0,
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

  const attempts = summary.totalSuccessCount + summary.totalFailCount;
  const failRatePct =
    attempts === 0 ? 0 : Math.round((summary.totalFailCount / attempts) * 100);

  /** 문자(LMS) 전환 건수는 미연동 — 요약·행 모두 0 */
  const smsSuccessSummary = 0;

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

  const dateRangeLabel = `${formatDotDate(dateFrom)} ~ ${formatDotDate(dateTo)}`;

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

      <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 p-6">
        <div className="mb-6 shrink-0 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              알림톡 발송 관리
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              발송 건별 내역과 예상 정산(건당 {summary.unitWon}원)을 확인합니다.
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              조회 결과 그룹 {total.toLocaleString("ko-KR")}건
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleExcelDownload()}
            disabled={exporting}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
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

        {/* 요약 카드 */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-600">
              이번달 발송 성공
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
              {summary.totalSuccessCount.toLocaleString("ko-KR")} 건
            </p>
            <p className="mt-1 text-xs text-gray-500">
              (카카오톡 {summary.totalSuccessCount.toLocaleString("ko-KR")} / 문자{" "}
              {smsSuccessSummary.toLocaleString("ko-KR")})
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              * 조회 기간·상태·검색과 동일 집계
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-600">
              이번달 발송 실패 🚨
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-red-600">
              {summary.totalFailCount.toLocaleString("ko-KR")} 건
            </p>
            <p className="mt-1 text-xs text-gray-500">
              (실패율 {failRatePct}%)
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-600">예상 정산 금액</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-blue-600">
              {summary.estimatedSettlementWon.toLocaleString("ko-KR")} 원
            </p>
            <p className="mt-1 text-xs text-gray-500">
              * 성공 {summary.totalSuccessCount.toLocaleString("ko-KR")}건 ×{" "}
              {summary.unitWon}원 기준
            </p>
          </div>
        </div>

        {/* 검색·필터 */}
        <form
          onSubmit={handleSearch}
          className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-md border border-gray-300 px-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              aria-label="시작일"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-md border border-gray-300 px-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              aria-label="종료일"
            />
            <span className="hidden text-xs text-gray-500 sm:inline">
              ({dateRangeLabel})
            </span>
          </div>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as AdminAlimtalkHistoryStatus | "all")
            }
            className="h-9 min-w-[8rem] rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            aria-label="상태"
          >
            <option value="all">전체</option>
            <option value="completed">완료</option>
            <option value="scheduled">예약</option>
            <option value="sending">발송 중</option>
            <option value="failed">불가</option>
          </select>
          <input
            type="search"
            placeholder="거래처명, 수신자 또는 수신번호..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="h-9 min-w-[12rem] flex-1 rounded-md border border-gray-300 px-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-900"
          >
            조회
          </button>
        </form>

        {error && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="scrollbar-thin max-h-[calc(100vh-380px)] min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    발송 일시 / 구분
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    수신 대상 / 내용
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-gray-700">
                    총 요청
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">
                    처리 상세 결과
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      불러오는 중…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const kakaoOk = row.successCount;
                    const smsOk = 0;
                    const failN = row.failCount;
                    const sendKindLabel =
                      row.listKind === "batch" ? "대량발송" : "단건발송";
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-gray-100 transition-colors hover:bg-gray-50/80"
                      >
                        <td className="align-top px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-900">
                              {formatSentAtDashboard(row.sentAt)}
                            </span>
                            <span className="mt-1 inline-block rounded px-2 py-0.5 text-xs text-gray-600 bg-gray-100 w-fit">
                              {sendKindLabel}
                            </span>
                          </div>
                        </td>
                        <td className="align-top px-4 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {row.clientName}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDetailRow(row)}
                              className="mt-1 flex cursor-pointer items-center gap-1 text-left text-xs text-blue-600 hover:underline"
                            >
                              <span aria-hidden>🔍</span>
                              메시지 상세보기
                            </button>
                          </div>
                        </td>
                        <td className="align-top px-4 py-4 text-center">
                          <span className="text-sm font-bold tabular-nums text-gray-900">
                            {row.totalCount.toLocaleString("ko-KR")} 건
                          </span>
                        </td>
                        <td className="align-top px-4 py-4">
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                              💬 카톡 {kakaoOk}
                            </span>
                            <span className="rounded-md bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
                              ✉️ 문자 {smsOk}
                            </span>
                            <span
                              className={`rounded-md px-2 py-1 text-xs font-semibold ${
                                failN > 0
                                  ? "bg-red-100 text-red-800 ring-1 ring-red-200"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              🚨 실패 {failN}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && total > 0 && (
            <div className="flex shrink-0 flex-col items-center gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
              <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-200">
                <div
                  className="absolute top-0 h-full rounded-full bg-gray-800 transition-all duration-200"
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
                  className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
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
                  className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
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
                <span className="min-w-[4rem] text-center text-sm font-medium text-gray-700">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
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
                  className="rounded-md border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40"
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
