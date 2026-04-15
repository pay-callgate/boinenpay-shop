"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogBody,
} from "@/components/ui/dialog";
import { toast } from "@/components/shop/ToastContext";
import { adminFetch } from "@/lib/admin-fetch";
import {
  parseRecipientsFromFile,
  type ParsedRecipient,
} from "@/lib/parse-alimtalk-recipients";

/** 스냅샷 기준 헤더·수정·발송 CTA 공통 다크 네이비 */
const HEADER_BG = "bg-[#1e293b]";
const BTN_DARK =
  "rounded-lg bg-[#1e293b] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-900";

/** 승인된 카카오 알림톡 템플릿(가변: #{storeName}, #{url}) */
const KAKAO_ALIMTALK_LINK_TEMPLATE = `안녕하세요.

화면으로 바로 주문하는
#{storeName} 콜링크 쇼핑입니다.

요청하신 서비스 이용을 위해 아래의 링크를 눌러 접속해 주세요.
#{url}

감사합니다.`;

function resolveKakaoLinkTemplate(storeName: string, orderUrl: string): string {
  const name = storeName?.trim() || "파트너";
  const url = orderUrl?.trim() || "(링크 준비 중)";
  return KAKAO_ALIMTALK_LINK_TEMPLATE.replace(/#\{storeName\}/g, name).replace(
    /#\{url\}/g,
    url
  );
}

/** 입력 시 하이픈 자동 삽입 (010-1234-1234 형태 유지) */
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10)
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11)
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  return digits;
}

/**
 * kakaotest index.html 의 normalizeKrPhone 과 동일: 앞자리 0 누락된 휴대폰 보정
 */
function normalizeKrPhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 && d.startsWith("10")) d = `0${d}`;
  if (d.length === 9 && d.startsWith("1")) d = `0${d}`;
  return d;
}

/** 미리보기 테이블: 2번 스냅샷 — 010-****-XXXX (가운데 4자리 마스킹) */
function maskPhoneDisplay(digits: string): string {
  const d = normalizeKrPhoneDigits(digits);
  if (d.length === 11) return `${d.slice(0, 3)}-****-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-***-${d.slice(6)}`;
  return formatPhoneDisplay(digits);
}

/** 건수 요약 배지용 (100명/회 기준 구간 수) */
const BULK_CHUNK = 100;

function getByteCount(text: string): number {
  return new TextEncoder().encode(text).length;
}

function downloadAlimtalkSampleCsv(): void {
  const bom = "\uFEFF";
  const csv = `${bom}phone,name\n01012345678,홍길동\n01098765432,김철수\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "alimtalk_recipients_sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
  partnerName: string;
  partnerSubdomain: string;
  partnerContact: string;
  clientId: string;
  clientSlug: string;
  assigned070Number: string;
  recipientPhone: string;
}

export function LinkNotificationModal({
  isOpen,
  onClose,
  partnerId,
  partnerName,
  partnerSubdomain,
  partnerContact,
  clientId,
  clientSlug,
  assigned070Number: _assigned070Number,
  recipientPhone,
}: Props) {
  void _assigned070Number;

  const [sendMode, setSendMode] = useState<"single" | "bulk">("single");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [senderNumber, setSenderNumber] = useState("");
  const [receiverNumber, setReceiverNumber] = useState("");
  const [senderEditable, setSenderEditable] = useState(false);
  const [receiverEditable, setReceiverEditable] = useState(false);
  const [messageEditable, setMessageEditable] = useState(false);
  const senderInputRef = useRef<HTMLInputElement>(null);
  const receiverInputRef = useRef<HTMLInputElement>(null);

  const [bulkRecipients, setBulkRecipients] = useState<ParsedRecipient[]>([]);
  const [bulkFileLabel, setBulkFileLabel] = useState<string | null>(null);
  const [bulkDragging, setBulkDragging] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const bulkProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  const partnerDisplayName =
    partnerName?.trim() || partnerSubdomain?.trim() || "파트너";

  useEffect(() => {
    if (!isOpen) return;
    const orderUrl =
      typeof window !== "undefined" && partnerSubdomain && clientSlug
        ? `${window.location.origin}/${partnerSubdomain}/${clientSlug}`
        : "";
    setMessage(resolveKakaoLinkTemplate(partnerDisplayName, orderUrl));
    setSenderNumber(
      partnerContact?.trim() ? formatPhoneInput(partnerContact.trim()) : ""
    );
    setReceiverNumber(
      recipientPhone?.trim() ? formatPhoneInput(recipientPhone.trim()) : ""
    );
    setSenderEditable(false);
    setReceiverEditable(false);
    setMessageEditable(false);
    setSendMode("single");
    setBulkRecipients([]);
    setBulkFileLabel(null);
    setBulkProgress(0);
    setBulkDragging(false);
  }, [
    isOpen,
    partnerDisplayName,
    partnerContact,
    partnerSubdomain,
    clientSlug,
    recipientPhone,
  ]);

  useEffect(() => {
    return () => {
      if (bulkProgressTimerRef.current) {
        clearInterval(bulkProgressTimerRef.current);
        bulkProgressTimerRef.current = null;
      }
    };
  }, []);

  const handleSenderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSenderNumber(formatPhoneInput(e.target.value));
    },
    []
  );

  const handleReceiverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setReceiverNumber(formatPhoneInput(e.target.value));
    },
    []
  );

  const handleSenderEdit = () => {
    setSenderEditable(true);
    setTimeout(() => senderInputRef.current?.focus(), 0);
  };

  const handleReceiverEdit = () => {
    setReceiverEditable(true);
    setTimeout(() => receiverInputRef.current?.focus(), 0);
  };

  const clearBulkList = () => {
    setBulkRecipients([]);
    setBulkFileLabel(null);
  };

  const processBulkFile = async (file: File) => {
    try {
      const rows = await parseRecipientsFromFile(file);
      setBulkRecipients(rows);
      setBulkFileLabel(file.name);
      if (rows.length === 0) {
        toast(
          "유효한 수신 번호가 없습니다. 열 이름(phone, 수신번호 등)을 확인해 주세요."
        );
      }
    } catch {
      toast("파일을 읽는 중 오류가 발생했습니다.");
      setBulkRecipients([]);
      setBulkFileLabel(null);
    }
  };

  const handleBulkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void processBulkFile(file);
  };

  const handleSend = async () => {
    const rawSender = senderNumber.replace(/\D/g, "");
    const rawReceiver = receiverNumber.replace(/\D/g, "");
    if (!rawReceiver) {
      toast("수신번호를 입력해 주세요.");
      return;
    }
    if (!message.trim()) {
      toast("메시지 내용이 비어 있습니다.");
      return;
    }
    setSending(true);
    try {
      const res = await adminFetch("/api/admin/notifications/link-kakao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          clientId,
          phone: rawReceiver,
          callback: rawSender || undefined,
          msg: message.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        tranId?: string;
      };
      if (!res.ok || !data.ok) {
        toast(data.message || "알림톡 발송에 실패했습니다.");
        return;
      }
      toast(
        data.tranId
          ? `발송 요청이 접수되었습니다. (tran_id: ${data.tranId})`
          : "발송 요청이 접수되었습니다."
      );
      onClose();
    } catch {
      toast("네트워크 오류로 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const handleBulkSend = async () => {
    const rawSender = senderNumber.replace(/\D/g, "");
    if (!message.trim()) {
      toast("메시지 내용이 비어 있습니다.");
      return;
    }
    if (bulkRecipients.length === 0) {
      toast("대량 발송할 수신자 목록을 업로드해 주세요.");
      return;
    }
    setSending(true);
    setBulkProgress(4);
    if (bulkProgressTimerRef.current)
      clearInterval(bulkProgressTimerRef.current);
    bulkProgressTimerRef.current = setInterval(() => {
      setBulkProgress((p) => (p < 92 ? p + 1 : p));
    }, 280);

    let completedOk = false;
    try {
      const res = await adminFetch("/api/admin/notifications/link-kakao/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId,
          clientId,
          callback: rawSender || undefined,
          msg: message.trim(),
          recipients: bulkRecipients.map((r) => ({
            phone: r.phone,
            name: r.name,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        attempted?: number;
        success?: number;
        failed?: number;
      };
      if (!res.ok || !data.ok) {
        toast(data.message || "대량 발송 처리에 실패했습니다.");
        setBulkProgress(0);
        return;
      }
      completedOk = true;
      toast(
        `대량 발송이 완료되었습니다. (시도 ${data.attempted ?? bulkRecipients.length}건 · 성공 ${data.success ?? 0} · 실패 ${data.failed ?? 0})`
      );
      onClose();
    } catch {
      toast("네트워크 오류로 대량 발송에 실패했습니다.");
      setBulkProgress(0);
    } finally {
      if (bulkProgressTimerRef.current) {
        clearInterval(bulkProgressTimerRef.current);
        bulkProgressTimerRef.current = null;
      }
      if (completedOk) setBulkProgress(100);
      setSending(false);
    }
  };

  const byteCount = getByteCount(message);

  const tabClass = (active: boolean) =>
    `px-4 py-2.5 text-sm transition-colors -mb-px border-b-2 ${
      active
        ? "border-[#1e293b] font-bold text-[#1e293b]"
        : "border-transparent font-medium text-gray-500 hover:text-gray-700"
    }`;

  /** 스냅샷 노란 박스 영역과 동일한 옅은 회색 배경 (#f3f4f6) */
  const inputLight =
    "h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-[#f3f4f6] px-3 text-sm text-gray-900 placeholder-gray-500 read-only:bg-[#f3f4f6] focus:border-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#1e293b]";

  /** 발신·수신 번호 행: 우측 열(모달) 가로를 가득 채움 */
  const phoneFieldRowClass = "flex w-full min-w-0 gap-2";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden bg-white p-0">
        {/* 헤더: 다크 네이비 (스냅샷 빨간 박스 영역) */}
        <div className={`relative shrink-0 px-6 pb-4 pt-6 ${HEADER_BG}`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-xl leading-none text-white transition-colors hover:text-slate-200"
            aria-label="닫기"
          >
            ✕
          </button>
          <h2 className="pr-10 text-lg font-bold text-white">
            고객사 Link 안내 메시지
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            거래처 담당자에게 주문 링크 안내 카카오 알림톡을 발송합니다. 본문은
            승인 템플릿에 맞게 파트너사명·고객사 주문 URL이 반영됩니다.
          </p>
        </div>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
          <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:min-h-[520px]">
            {/* 좌측: 알림톡 미리보기(상) → 메시지 내용 수정(하) */}
            <div className="flex flex-col gap-6 lg:col-span-5">
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-900">
                  알림톡 미리보기
                </h3>
                <div
                  className="flex min-h-[320px] max-h-[400px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-[#f3f4f6] shadow-sm"
                  style={{ boxShadow: "inset 0 0 16px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex shrink-0 justify-center border-b border-gray-200/80 py-2">
                    <div className="h-4 w-12 rounded-full bg-gray-300" />
                  </div>
                  <div className="min-h-[220px] flex-1 overflow-y-auto p-4">
                    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                        {message || "메시지가 여기에 표시됩니다."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900">
                    메시지 내용 수정
                  </h3>
                  <button
                    type="button"
                    onClick={() => setMessageEditable((v) => !v)}
                    className="shrink-0 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    {messageEditable ? "미리보기로 보기" : "내용 수정"}
                  </button>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  readOnly={!messageEditable}
                  rows={4}
                  className="max-h-[140px] w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-800 placeholder-gray-400 read-only:bg-gray-50 focus:border-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#1e293b]"
                />
                <p className="mt-2 text-xs text-gray-500">
                  [알림톡 본문] {message.length}자 · {byteCount} byte (매뉴얼 기준 MSG
                  최대 1000자)
                </p>
              </div>
            </div>

            {/* 우측: 탭 → 발신 → 수신/대량 */}
            <div className="flex min-h-0 w-full min-w-0 flex-col gap-6 lg:col-span-7">
              <div className="flex w-full min-w-0 flex-1 flex-col">
                <label className="mb-2 block text-sm font-bold text-gray-900">
                  발송 방식
                </label>
                <div className="flex border-b border-gray-200 bg-white/50">
                  <button
                    type="button"
                    onClick={() => setSendMode("single")}
                    className={tabClass(sendMode === "single")}
                  >
                    단건 발송
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendMode("bulk")}
                    className={tabClass(sendMode === "bulk")}
                  >
                    대량 발송
                  </button>
                </div>

                <div className="mt-6 w-full space-y-6">
                  <div className="w-full min-w-0">
                    <label className="mb-2 block text-sm font-bold text-gray-900">
                      발신번호 설정
                    </label>
                    <div className={phoneFieldRowClass}>
                      <input
                        ref={senderInputRef}
                        type="text"
                        value={senderNumber}
                        onChange={handleSenderChange}
                        readOnly={!senderEditable}
                        placeholder="발신번호"
                        className={inputLight}
                      />
                      <button
                        type="button"
                        onClick={handleSenderEdit}
                        className={`shrink-0 ${BTN_DARK}`}
                      >
                        수정
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      파트너 대표 번호가 기본 입력됩니다.
                    </p>
                  </div>

                  {sendMode === "single" ? (
                    <div className="w-full min-w-0">
                      <label className="mb-2 block text-sm font-bold text-gray-900">
                        수신번호 입력
                      </label>
                      <div className={phoneFieldRowClass}>
                        <input
                          ref={receiverInputRef}
                          type="text"
                          value={receiverNumber}
                          onChange={handleReceiverChange}
                          readOnly={!receiverEditable}
                          placeholder="수신번호"
                          maxLength={13}
                          className={inputLight}
                        />
                        <button
                          type="button"
                          onClick={handleReceiverEdit}
                          className={`shrink-0 ${BTN_DARK}`}
                        >
                          수정
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        거래처 담당자 번호가 기본 입력됩니다.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full min-w-0 space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-gray-900">
                          수신번호 설정(대량 업로드)
                        </label>

                        <div className="mb-3 flex justify-end">
                          <button
                            type="button"
                            onClick={downloadAlimtalkSampleCsv}
                            className="inline-flex items-center justify-center rounded-lg border border-[#2d3340] bg-white px-[18px] py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                          >
                            엑셀샘플 다운로드
                          </button>
                        </div>

                        <input
                          ref={bulkFileInputRef}
                          type="file"
                          accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                          className="hidden"
                          onChange={handleBulkInputChange}
                        />

                        <div
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              bulkFileInputRef.current?.click();
                            }
                          }}
                          onClick={() => bulkFileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setBulkDragging(true);
                          }}
                          onDragLeave={() => setBulkDragging(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setBulkDragging(false);
                            const f = e.dataTransfer.files?.[0];
                            if (f) void processBulkFile(f);
                          }}
                          className={`cursor-pointer rounded-[10px] border-2 border-dashed px-4 py-5 text-center transition-colors ${
                            bulkDragging
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-[#d8dee8] bg-[#fafbfd] hover:border-[#1e3a5f] hover:bg-[#f3f6fa]"
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-900">
                            <strong>
                              CSV / Excel(.xlsx, .xls)을 여기에 드롭
                            </strong>
                            하거나 파일을 선택하세요.
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-[#5c6473]">
                            브랜드용 발송 도구에서 흔히 쓰는 방식: 업로드 직후
                            건수 요약 + 미리보기 테이블로 검증합니다.
                          </p>
                          <div
                            className="mx-auto mt-3 flex max-w-lg items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => bulkFileInputRef.current?.click()}
                              className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                            >
                              파일 선택
                            </button>
                            <span className="min-w-0 flex-1 truncate text-sm text-gray-500">
                              {bulkFileLabel ?? "선택된 파일 없음"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {bulkRecipients.length > 0 && (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[0.8125rem] font-semibold text-[#0d6b4d]">
                              유효 수신{" "}
                              <strong className="text-base">
                                {bulkRecipients.length}
                              </strong>
                              명
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2f7] px-3 py-1.5 text-[0.8125rem] font-medium text-[#5c6473]">
                              예상 API 호출{" "}
                              <strong className="text-base text-gray-800">
                                {Math.ceil(
                                  bulkRecipients.length / BULK_CHUNK
                                ) || 0}
                              </strong>
                              회{" "}
                              <span className="text-xs text-[#5c6473]">
                                (100명/회)
                              </span>
                            </span>
                          </div>

                          <div className="overflow-hidden rounded-lg border border-[#d8dee8] bg-white">
                            <div className="flex items-center justify-between border-b border-[#d8dee8] bg-[#f4f6f9] px-3 py-2">
                              <span className="text-xs text-[#5c6473]">
                                미리보기 (최대 15행)
                              </span>
                              <button
                                type="button"
                                onClick={clearBulkList}
                                className="rounded-md bg-[#eef1f5] px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-200"
                              >
                                목록 비우기
                              </button>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                              <table className="w-full border-collapse text-[0.8125rem]">
                                <thead>
                                  <tr className="sticky top-0 border-b border-[#d8dee8] bg-[#fafbfc]">
                                    <th className="w-12 px-3 py-2 text-left font-semibold text-gray-900">
                                      #
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-900">
                                      이름
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-900">
                                      휴대폰
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bulkRecipients.slice(0, 15).map((r, i) => (
                                    <tr
                                      key={`${r.phone}-${i}`}
                                      className="border-b border-[#d8dee8] last:border-b-0"
                                    >
                                      <td className="px-3 py-2 text-gray-700">
                                        {i + 1}
                                      </td>
                                      <td className="px-3 py-2 text-gray-900">
                                        {r.name?.trim() || "(이름 없음)"}
                                      </td>
                                      <td className="px-3 py-2 font-mono text-gray-800">
                                        {maskPhoneDisplay(r.phone)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}

                      {sending && sendMode === "bulk" && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>발송 진행 중…</span>
                            <span>{bulkProgress}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-[#1e293b] transition-[width] duration-200"
                              style={{ width: `${bulkProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogBody>

        {/* 하단 액션: 동일 너비 버튼 2개 우측 정렬 */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex h-10 w-[12rem] shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() =>
              void (sendMode === "single" ? handleSend() : handleBulkSend())
            }
            disabled={sending}
            className="inline-flex h-10 w-[12rem] shrink-0 items-center justify-center rounded-lg bg-[#1e293b] px-2 text-center text-sm font-bold leading-tight text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-60"
          >
            {sending
              ? sendMode === "bulk"
                ? "대량 발송 중…"
                : "발송 중…"
              : "카카오톡 발송하기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
