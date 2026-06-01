"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogBody,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin-fetch";
import { Badge } from "@/components/ui/badge";
import { ADMIN_MODAL_HEADER_BAR_CLASS } from "@/lib/admin-dialog-policy";
import { formatMsgagentResultCodeForAdminDisplay } from "@/lib/msgagent-webshot-result-codes";
import { formatTransmissionResultForAdminDisplay } from "@/lib/msgagent-transmission-result-codes";

/** `public/images` — LinkNotificationModal과 동일한 카카오톡 채널 CI PNG */
const CALLLINK_KAKAO_CHANNEL_PROFILE_SRC = "/images/calllink-kakao-channel-ci.png";

/**
 * 알림톡 본문 미리보기: http(s) 및 www… 를 카카오톡과 같이 파란 밑줄 링크 스타일로 표시.
 */
function alimtalkPreviewBodyWithLinks(text: string): ReactNode {
  const t = text.trim();
  if (!t) return "내용 없음";
  const re = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(t)) !== null) {
    if (m.index > last) {
      out.push(t.slice(last, m.index));
    }
    out.push(
      <span
        key={`${m.index}-${m[0].slice(0, 24)}`}
        className="text-[#1264d4] underline underline-offset-1"
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < t.length) out.push(t.slice(last));
  return out.length ? out : t;
}

function formatKakaoPreviewClock(): string {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// 추후 메시지 내용 본문 영역을 다시 제공할 때 사용합니다.
// function getByteCount(text: string): number {
//   return new TextEncoder().encode(text).length;
// }

function formatPhoneDisplay(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11)
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

const inputReadOnly =
  "h-11 w-full rounded-lg border border-gray-200 bg-[#f3f4f6] px-3 text-sm text-gray-900";

export type AlimtalkBatchRecipient = {
  id: string;
  recipientName: string;
  recipientPhone: string;
  success: boolean;
  failed?: boolean;
  pending?: boolean;
  resultCode: string | null;
  kakaoReportCode?: string | null;
  kakaoReportMessage?: string | null;
  smsReportCode?: string | null;
  smsReportMessage?: string | null;
  errorMessage: string | null;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  body: string;
  senderPhone: string;
  receiverPhone: string;
  /** 대량 발송이면 수신자 탭·목록 API 조회 */
  batchId: string | null;
  listKind: "single" | "batch";
}

/**
 * LinkNotificationModal 과 동일한 헤더·미리보기 레이아웃, 발송 내역용 읽기 전용.
 * batch 행이면 [수신자 목록] 탭에서 개별 수신자를 표시합니다.
 */
export function AlimtalkHistoryDetailModal({
  isOpen,
  onClose,
  body,
  senderPhone,
  receiverPhone,
  batchId,
  listKind,
}: Props) {
  // const byteCount = getByteCount(body);
  const showRecipientsTab = listKind === "batch" && !!batchId;
  const alimtalkPreviewClock = formatKakaoPreviewClock();

  const [tab, setTab] = useState<"message" | "recipients">("message");
  const [recipients, setRecipients] = useState<AlimtalkBatchRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);

  const loadRecipients = useCallback(async () => {
    if (!batchId) return;
    setRecipientsLoading(true);
    setRecipientsError(null);
    try {
      const res = await adminFetch(
        `/api/admin/messages/batch/${encodeURIComponent(batchId)}`
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setRecipientsError(json.message || "수신자 목록을 불러오지 못했습니다.");
        setRecipients([]);
        return;
      }
      setRecipients(json.data?.recipients ?? []);
    } catch {
      setRecipientsError("네트워크 오류");
      setRecipients([]);
    } finally {
      setRecipientsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (!isOpen) {
      setTab("message");
      setRecipients([]);
      setRecipientsError(null);
      return;
    }
    if (showRecipientsTab) {
      void loadRecipients();
    }
  }, [isOpen, showRecipientsTab, loadRecipients]);

  const receiverLabel =
    listKind === "batch"
      ? `${receiverPhone ? `${receiverPhone} 등` : "다수"} (상세 탭에서 확인)`
      : formatPhoneDisplay(receiverPhone);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden bg-white p-0">
        <div className={ADMIN_MODAL_HEADER_BAR_CLASS}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-xl leading-none text-white transition-colors hover:text-slate-200"
            aria-label="닫기"
          >
            ✕
          </button>
          <h2 className="pr-10 text-lg font-bold text-white">
            Link 안내 발송
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            발송된 알림톡 본문을 확인합니다. (읽기 전용)
          </p>
        </div>

        {showRecipientsTab && (
          <div className="flex shrink-0 gap-1 border-b border-slate-200 bg-slate-50 px-4 pt-3">
            <button
              type="button"
              onClick={() => setTab("message")}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === "message"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 ring-b-0"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              메시지
            </button>
            <button
              type="button"
              onClick={() => setTab("recipients")}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === "recipients"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 ring-b-0"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              수신자 목록
            </button>
          </div>
        )}

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
          {tab === "recipients" && showRecipientsTab ? (
            <div className="flex min-h-0 flex-col">
              <p className="mb-3 text-sm text-slate-600">
                대량 발송 수신자별 최종 배송 결과입니다. 리포트 대기 건은
                발송 관리 화면에서 <span className="font-semibold">결과 갱신</span>
                을 실행해 주세요.
              </p>
              {recipientsLoading && (
                <p className="py-8 text-center text-sm text-slate-500">
                  불러오는 중…
                </p>
              )}
              {recipientsError && (
                <p className="py-4 text-sm text-red-600" role="alert">
                  {recipientsError}
                </p>
              )}
              {!recipientsLoading && !recipientsError && (
                <div className="max-h-[min(52vh,480px)] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">
                          수신자
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">
                          수신번호
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">
                          결과코드·설명
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-700">
                          사유
                        </th>
                        <th className="px-3 py-2.5 text-center font-semibold text-slate-700">
                          결과
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            수신자가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        recipients.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-3 py-2.5 text-slate-800">
                              {r.recipientName}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-slate-700">
                              {r.recipientPhone || "—"}
                            </td>
                            <td className="max-w-[14rem] px-3 py-2.5 text-left text-xs leading-snug text-slate-800 [overflow-wrap:anywhere]">
                              {r.kakaoReportCode
                                ? formatTransmissionResultForAdminDisplay(
                                    r.kakaoReportCode,
                                    r.kakaoReportMessage
                                  )
                                : formatMsgagentResultCodeForAdminDisplay(
                                    r.resultCode
                                  )}
                            </td>
                            <td className="max-w-[200px] px-3 py-2.5 text-xs text-slate-700">
                              <span className="line-clamp-3 break-words">
                                {r.errorMessage ?? "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {r.pending ? (
                                <Badge variant="alim_sending">리포트 대기</Badge>
                              ) : r.success ? (
                                <Badge variant="alim_completed">성공</Badge>
                              ) : (
                                <Badge variant="alim_failed">실패</Badge>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:min-h-[520px]">
                <div className="flex flex-col gap-6 lg:col-span-5">
                  <div>
                    <h3 className="mb-2 text-sm font-bold text-gray-900">
                      알림톡 미리보기
                    </h3>
                    <div
                      className="h-[clamp(460px,62vh,520px)] max-w-sm overflow-y-auto rounded-xl bg-[#bacee0] p-4 shadow-inner"
                      aria-label="카카오톡 알림톡 미리보기"
                    >
                      <div className="flex items-start gap-2">
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#1a2b4a] ring-1 ring-black/10">
                          <Image
                            src={CALLLINK_KAKAO_CHANNEL_PROFILE_SRC}
                            alt="콜링크쇼핑"
                            width={96}
                            height={96}
                            sizes="36px"
                            className="h-full w-full object-cover"
                            priority
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1">
                            <span className="text-[15px] font-normal leading-tight text-black">
                              콜링크쇼핑
                            </span>
                          </div>

                          <div className="relative pt-0.5">
                            <div
                              className="absolute -right-0.5 -top-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#191919] shadow-sm ring-2 ring-[#bacee0]"
                              aria-hidden
                            >
                              <span className="text-[7.5px] font-normal lowercase leading-none tracking-tighter text-white">
                                kakao
                              </span>
                            </div>
                            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.06]">
                              <div className="rounded-t-2xl bg-[#ffeb00] px-3.5 py-2.5">
                                <span className="text-[15px] font-bold leading-snug text-black">
                                  알림톡 도착
                                </span>
                              </div>
                              <div className="px-3.5 py-3">
                                <div className="whitespace-pre-wrap break-all text-[15px] leading-[1.5] text-black">
                                  {alimtalkPreviewBodyWithLinks(body)}
                                </div>
                              </div>
                            </div>
                          </div>

                          {alimtalkPreviewClock ? (
                            <div className="mt-1 flex justify-end">
                              <span className="text-[11px] leading-none text-[#576575]">
                                {alimtalkPreviewClock}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/*
                    추후 고객 요청으로 메시지 내용 본문 영역을 다시 제공할 때 사용합니다.
                    <div>
                      <h3 className="mb-2 text-sm font-bold text-gray-900">
                        메시지 내용
                      </h3>
                      <textarea
                        value={body}
                        readOnly
                        rows={5}
                        className="max-h-[160px] w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-800"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        [알림톡 본문] {body.length}자 · {byteCount} byte (매뉴얼
                        기준 MSG 최대 1000자)
                      </p>
                    </div>
                  */}
                </div>

                <div className="flex min-h-0 w-full min-w-0 flex-col gap-6 lg:col-span-7">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-900">
                      발신번호
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formatPhoneDisplay(senderPhone)}
                      className={inputReadOnly}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-900">
                      수신번호
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={receiverLabel}
                      className={inputReadOnly}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogBody>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 min-w-[12rem] shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
