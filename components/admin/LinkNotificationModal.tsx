"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/shop/ToastContext";
import { adminFetch } from "@/lib/admin-fetch";

const BTN_NAVY = "#1e293b";

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

function getByteCount(text: string): number {
  return new TextEncoder().encode(text).length;
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
  assigned070Number,
  recipientPhone,
}: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [senderNumber, setSenderNumber] = useState("");
  const [receiverNumber, setReceiverNumber] = useState("");
  const [senderEditable, setSenderEditable] = useState(false);
  const [receiverEditable, setReceiverEditable] = useState(false);
  const [messageEditable, setMessageEditable] = useState(false);
  const senderInputRef = useRef<HTMLInputElement>(null);
  const receiverInputRef = useRef<HTMLInputElement>(null);

  const partnerDisplayName = partnerName?.trim() || partnerSubdomain?.trim() || "파트너";

  useEffect(() => {
    if (!isOpen) return;
    const orderUrl =
      typeof window !== "undefined" && partnerSubdomain && clientSlug
        ? `${window.location.origin}/${partnerSubdomain}/${clientSlug}`
        : "";
    setMessage(resolveKakaoLinkTemplate(partnerDisplayName, orderUrl));
    setSenderNumber(partnerContact?.trim() ? formatPhoneInput(partnerContact.trim()) : "");
    setReceiverNumber(recipientPhone?.trim() ? formatPhoneInput(recipientPhone.trim()) : "");
    setSenderEditable(false);
    setReceiverEditable(false);
    setMessageEditable(false);
  }, [isOpen, partnerDisplayName, partnerContact, partnerSubdomain, clientSlug, recipientPhone]);

  const handleSenderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSenderNumber(formatPhoneInput(e.target.value));
  }, []);

  const handleReceiverChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setReceiverNumber(formatPhoneInput(e.target.value));
  }, []);

  const handleSenderEdit = () => {
    setSenderEditable(true);
    setTimeout(() => senderInputRef.current?.focus(), 0);
  };

  const handleReceiverEdit = () => {
    setReceiverEditable(true);
    setTimeout(() => receiverInputRef.current?.focus(), 0);
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

  const byteCount = getByteCount(message);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>고객사 Link 안내 메시지</DialogTitle>
          <p className="mt-1 text-sm text-slate-300">
            거래처 담당자에게 주문 링크 안내 카카오 알림톡을 발송합니다. 본문은
            승인 템플릿에 맞게 파트너사명·고객사 주문 URL이 반영됩니다.
          </p>
          <DialogClose>✕</DialogClose>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1">
          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
            {/* 좌측: 핸드폰 느낌의 메시지 미리보기 */}
            <div className="flex flex-col">
              <p className="mb-2 text-sm font-semibold text-slate-700">메시지 미리보기</p>
              <div
                className="flex flex-1 flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-inner"
                style={{
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.04)",
                  minHeight: "320px",
                }}
              >
                <div className="flex justify-center border-b border-slate-100 py-2">
                  <div className="h-5 w-16 rounded-full bg-slate-200" />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {messageEditable ? (
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="h-full min-h-[200px] w-full resize-none rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                      placeholder="메시지 내용"
                    />
                  ) : (
                    <div className="rounded-lg bg-slate-100 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {message || "메시지 내용이 여기에 표시됩니다."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xs text-slate-500">
                  [알림톡 본문] {message.length}자 · {byteCount} byte (매뉴얼 기준 MSG
                  최대 1000자)
                </span>
              </div>
            </div>

            {/* 우측: 수신/발신 번호 입력 폼 */}
            <div className="flex flex-col gap-6">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  발신번호 설정
                </label>
                <div className="flex gap-2">
                  <input
                    ref={senderInputRef}
                    type="text"
                    value={senderNumber}
                    onChange={handleSenderChange}
                    readOnly={!senderEditable}
                    placeholder="발신번호를 등록해주세요"
                    className="h-11 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 placeholder-slate-400 read-only:cursor-default read-only:bg-slate-50 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleSenderEdit}
                    className="shrink-0 rounded-md px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: BTN_NAVY }}
                  >
                    수정
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  파트너사 대표 번호가 자동 입력되며, 수정 가능합니다.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  수신번호 입력
                </label>
                <div className="flex gap-2">
                  <input
                    ref={receiverInputRef}
                    type="text"
                    value={receiverNumber}
                    onChange={handleReceiverChange}
                    readOnly={!receiverEditable}
                    placeholder="수신번호"
                    maxLength={13}
                    className="h-11 flex-1 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 placeholder-slate-400 read-only:cursor-default read-only:bg-slate-50 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleReceiverEdit}
                    className="shrink-0 rounded-md px-3 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: BTN_NAVY }}
                  >
                    수정
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  거래처 담당자 연락처가 자동 입력되며, 수정 가능합니다.
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  메시지 내용 수정
                </label>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    필요 시 내용을 수정할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMessageEditable((v) => !v)}
                    className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: BTN_NAVY }}
                  >
                    {messageEditable ? "미리보기" : "메시지 내용 수정"}
                  </button>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="w-full resize-none rounded-md border border-slate-300 bg-[#FFFFFF] px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-transparent bg-transparent px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: BTN_NAVY }}
          >
            {sending ? "발송 중…" : "카카오톡 발송하기"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
