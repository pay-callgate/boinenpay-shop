"use client";

import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { MessageSquare } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AlimtalkHistoryDetailModal } from "@/components/admin/AlimtalkHistoryDetailModal";
import {
  type AdminAlimtalkHistoryStatus,
  type AdminAlimtalkMessageRow,
} from "@/lib/admin-alimtalk-messages";
import { formatMsgagentResultCodeForAdminDisplay } from "@/lib/msgagent-webshot-result-codes";

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

/** Agent2 접수 결과 — 성공/실패 칩 호버용 (브라우저 기본 툴팁) */
function buildAlimtalkAgentTooltip(row: AdminAlimtalkMessageRow): string {
  const rc = row.providerResultCode?.trim() ?? "";
  const em = row.providerErrorMessage?.trim() ?? "";
  const parts: string[] = [];
  if (rc) {
    parts.push(
      `결과코드: ${formatMsgagentResultCodeForAdminDisplay(rc)}`
    );
  }
  if (em) {
    parts.push(em.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim());
  }
  if (parts.length > 0) {
    return parts.join(" — ").slice(0, 480);
  }
  if (row.failCount > 0) {
    return "접수 실패입니다. 코드·메시지가 비어 있으면 메시지 상세보기에서 확인해 주세요.";
  }
  if (row.successCount > 0) {
    return "접수 성공입니다. 결과코드가 아직 목록에 없으면 저장 시점 이전 데이터일 수 있습니다.";
  }
  return "발송 접수 결과";
}

/** 발송 결과 표 — 숫자 + 귀여운 이모지 배지 (구 UI 톤) */
function AlimtalkResultStatChip({
  emoji,
  value,
  tone,
  title,
}: {
  /** 비우면 숫자만 표시 (총발송 등) */
  emoji?: string;
  value: number;
  tone: "total" | "success" | "fail" | "kakaoOk" | "kakaoBad" | "smsOk" | "smsBad";
  /** 있으면 호버 시 결과코드·메시지 안내 (title 속성) */
  title?: string;
}) {
  const ring =
    "inline-flex min-w-[3.25rem] items-center justify-center gap-0.5 rounded-md px-2 py-1 text-xs font-semibold tabular-nums ring-1";
  const tones: Record<typeof tone, string> = {
    total: `${ring} bg-violet-50 text-violet-900 ring-violet-100`,
    success: `${ring} bg-green-50 text-green-800 ring-green-100`,
    fail:
      value > 0
        ? `${ring} bg-red-50 text-red-800 ring-red-200`
        : `${ring} bg-slate-50 text-slate-500 ring-slate-100`,
    kakaoOk: `${ring} bg-amber-50/90 text-amber-900 ring-amber-100`,
    kakaoBad:
      value > 0
        ? `${ring} bg-orange-50 text-orange-900 ring-orange-200`
        : `${ring} bg-amber-50/50 text-amber-800/70 ring-amber-100/80`,
    smsOk: `${ring} bg-sky-50 text-sky-900 ring-sky-100`,
    smsBad:
      value > 0
        ? `${ring} bg-rose-50 text-rose-900 ring-rose-200`
        : `${ring} bg-slate-50 text-slate-400 ring-slate-100`,
  };
  const showEmoji = emoji != null && emoji !== "";
  return (
    <span
      className={`${tones[tone]}${title ? " cursor-help" : ""}${showEmoji ? "" : " gap-0"}`}
      title={title || undefined}
    >
      {showEmoji ? (
        <span className="select-none text-[1.05rem] leading-none" aria-hidden>
          {emoji}
        </span>
      ) : null}
      {value.toLocaleString("ko-KR")}
    </span>
  );
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
    <Fragment>
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
          providerResultCode={detailRow.providerResultCode ?? null}
          providerErrorMessage={detailRow.providerErrorMessage ?? null}
          deliveryOk={detailRow.failCount === 0}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
        <AdminPageHeader
          className="shrink-0"
          eyebrow="Clients · Alimtalk"
          title="알림톡 발송 관리"
          titleIcon={MessageSquare}
          description={
            <Fragment>
              <p>발송 건별 내역과 예상 정산(건당 {summary.unitWon}원)을 확인합니다.</p>
              <p className="mt-0.5 text-xs text-slate-500">
                조회 결과 그룹 {total.toLocaleString("ko-KR")}건
              </p>
            </Fragment>
          }
        />

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
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="search"
              placeholder="거래처명, 수신자 또는 수신번호..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="h-9 w-[200px] max-w-[calc(100vw-8rem)] rounded-md border border-gray-300 px-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:w-56"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-black px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-900"
            >
              조회
            </button>
          </div>
          <div className="ml-auto flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => void handleExcelDownload()}
              disabled={exporting}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50"
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
        </form>

        {error && (
          <p className="mb-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="scrollbar-thin max-h-[calc(100vh-380px)] min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[72rem] border-collapse text-sm">
              <caption className="sr-only">
                알림톡 발송 내역. 좌측은 발송 정보, 우측은 접수 건수 요약입니다.
              </caption>
              <thead className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                <tr>
                  <th
                    rowSpan={3}
                    className="whitespace-nowrap break-keep border-r border-slate-200/60 px-3 py-3 text-left text-sm font-bold text-slate-700"
                  >
                    발송일시
                  </th>
                  <th
                    rowSpan={3}
                    className="whitespace-nowrap break-keep border-r border-slate-200/60 px-3 py-3 text-left text-sm font-bold text-slate-700"
                  >
                    발송 구분
                  </th>
                  <th
                    rowSpan={3}
                    className="whitespace-nowrap break-keep border-r border-slate-200/60 px-3 py-3 text-left text-sm font-bold text-slate-700"
                  >
                    발송자
                  </th>
                  <th
                    rowSpan={3}
                    className="whitespace-nowrap break-keep border-r border-slate-200/60 px-3 py-3 text-left text-sm font-bold text-slate-700"
                  >
                    발송 내용
                  </th>
                  <th
                    rowSpan={3}
                    className="whitespace-nowrap break-keep border-r border-slate-200/60 px-3 py-3 text-center text-sm font-bold text-slate-700"
                  >
                    총발송
                  </th>
                  <th
                    rowSpan={3}
                    className="whitespace-nowrap break-keep border-r border-slate-200/60 px-3 py-3 text-center text-sm font-bold text-green-700"
                  >
                    성공
                  </th>
                  <th
                    rowSpan={3}
                    className="whitespace-nowrap break-keep border-r border-slate-200/60 px-3 py-3 text-center text-sm font-bold text-red-600"
                  >
                    실패
                  </th>
                  <th
                    colSpan={4}
                    className="whitespace-nowrap break-keep border-b border-slate-200/60 px-3 py-2.5 text-center text-sm font-bold tracking-wide text-slate-800"
                  >
                    발송 유형별
                  </th>
                </tr>
                <tr>
                  <th
                    colSpan={2}
                    className="whitespace-nowrap break-keep border-b border-r border-slate-200/60 px-2 py-2.5 text-center text-sm font-semibold text-slate-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <span
                        className="select-none text-[1.05rem] leading-none"
                        aria-hidden
                      >
                        💬
                      </span>
                      카카오톡
                    </span>
                  </th>
                  <th
                    colSpan={2}
                    className="whitespace-nowrap break-keep border-b border-slate-200/60 px-2 py-2.5 text-center text-sm font-semibold text-slate-700"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      <span
                        className="select-none text-[1.05rem] leading-none"
                        aria-hidden
                      >
                        ✉️
                      </span>
                      문자(전환 발송)
                    </span>
                  </th>
                </tr>
                <tr>
                  <th className="whitespace-nowrap break-keep border-r border-slate-200/60 px-2 py-2.5 text-center text-sm font-semibold text-green-700">
                    성공
                  </th>
                  <th className="whitespace-nowrap break-keep border-r border-slate-200/60 px-2 py-2.5 text-center text-sm font-semibold text-red-600">
                    실패
                  </th>
                  <th className="whitespace-nowrap break-keep border-r border-slate-200/60 px-2 py-2.5 text-center text-sm font-semibold text-green-700">
                    성공
                  </th>
                  <th className="whitespace-nowrap break-keep px-2 py-2.5 text-center text-sm font-semibold text-red-600">
                    실패
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      불러오는 중…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-sm text-gray-500"
                    >
                      내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const total = row.totalCount;
                    const success = row.successCount;
                    const fail = row.failCount;
                    /** 접수 집계만 존재: 성공 건은 카카오톡으로 귀속, 문자 전환 건수는 미연동(0) */
                    const kakaoSuccess = success;
                    const kakaoFail = fail;
                    const smsSuccess = 0;
                    const smsFail = 0;
                    const sendKindLabel =
                      row.listKind === "batch" ? "대량발송" : "단건발송";
                    const agentTooltip = buildAlimtalkAgentTooltip(row);
                    const cellWrap =
                      "whitespace-nowrap px-1 py-2 text-center align-middle sm:px-2";
                    return (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-slate-50/90"
                      >
                          <td className="align-top whitespace-nowrap px-3 py-3 text-sm text-gray-900">
                            {formatSentAtDashboard(row.sentAt)}
                          </td>
                          <td className="align-top px-3 py-3">
                            <span className="inline-block rounded px-2 py-0.5 text-xs text-gray-600 bg-gray-100">
                              {sendKindLabel}
                            </span>
                          </td>
                          <td className="align-top px-3 py-3">
                            <span className="font-medium text-gray-900">
                              {row.clientName}
                            </span>
                          </td>
                          <td className="align-top px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setDetailRow(row)}
                              className="flex cursor-pointer items-center gap-1 text-left text-xs text-blue-600 hover:underline"
                            >
                              <span aria-hidden>🔍</span>
                              메시지 상세보기
                            </button>
                          </td>
                          <td className={cellWrap}>
                            <AlimtalkResultStatChip
                              value={total}
                              tone="total"
                            />
                          </td>
                          <td className={cellWrap}>
                            <AlimtalkResultStatChip
                              emoji="✅"
                              value={success}
                              tone="success"
                              title={agentTooltip}
                            />
                          </td>
                          <td className={cellWrap}>
                            <AlimtalkResultStatChip
                              emoji="🚨"
                              value={fail}
                              tone="fail"
                              title={agentTooltip}
                            />
                          </td>
                          <td className={cellWrap}>
                            <AlimtalkResultStatChip
                              value={kakaoSuccess}
                              tone="kakaoOk"
                            />
                          </td>
                          <td className={cellWrap}>
                            <AlimtalkResultStatChip
                              value={kakaoFail}
                              tone="kakaoBad"
                            />
                          </td>
                          <td className={cellWrap}>
                            <AlimtalkResultStatChip
                              value={smsSuccess}
                              tone="smsOk"
                            />
                          </td>
                          <td className={cellWrap}>
                            <AlimtalkResultStatChip
                              value={smsFail}
                              tone="smsBad"
                            />
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
          <p className="break-keep text-sm leading-relaxed text-blue-700">
            ※ 총 발송 = 성공 + 실패,  성공 = 카카오톡 성공 + 문자전환 발송 성공 건수
          </p>
        </div>
      </div>
    </Fragment>
  );
}
