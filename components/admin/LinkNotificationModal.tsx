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

const BTN_NAVY = "#1e293b";

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
  partnerName: string;
  partnerSubdomain: string;
  partnerContact: string;
  clientSlug: string;
  assigned070Number: string;
  recipientPhone: string;
}

export function LinkNotificationModal({
  isOpen,
  onClose,
  partnerName,
  partnerSubdomain,
  partnerContact,
  clientSlug,
  assigned070Number,
  recipientPhone,
}: Props) {
  const [message, setMessage] = useState("");
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
    const url =
      typeof window !== "undefined" && partnerSubdomain && clientSlug
        ? `${window.location.origin}/${partnerSubdomain}/${clientSlug}`
        : "";
    const filled070 = assigned070Number?.trim() || "미등록";
    const filled = `안녕하세요. ${partnerDisplayName}입니다.
저희 서비스를 이용해주셔서 감사합니다.
상품 주문을 위한 전용 링크를 보내드립니다.

주문 전용 링크:
${url || "(링크 준비 중)"}

연동 070 번호:
${filled070}

위 링크를 통해 간편하게 주문하실 수 있습니다.
앞으로도 많은 이용 부탁드립니다.
감사합니다.`;
    setMessage(filled);
    setSenderNumber(partnerContact?.trim() ? formatPhoneInput(partnerContact.trim()) : "");
    setReceiverNumber(recipientPhone?.trim() ? formatPhoneInput(recipientPhone.trim()) : "");
    setSenderEditable(false);
    setReceiverEditable(false);
    setMessageEditable(false);
  }, [isOpen, partnerDisplayName, partnerContact, partnerSubdomain, clientSlug, assigned070Number, recipientPhone]);

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

  const handleSend = () => {
    const rawSender = senderNumber.replace(/\D/g, "");
    const rawReceiver = receiverNumber.replace(/\D/g, "");
    const payload = {
      발신번호: rawSender,
      수신번호: rawReceiver,
      메시지내용: message,
    };
    console.log("[Link 안내 문자 발송] 준비 중 데이터:", payload);
    toast("발송 기능 준비 중입니다.");
    onClose();
  };

  const byteCount = getByteCount(message);
  const isLms = byteCount > 90;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>고객사 Link 안내 메시지</DialogTitle>
          <p className="mt-1 text-sm text-slate-300">
            거래처 담당자에게 주문 링크 안내 문자를 발송합니다.
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
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  [SMS/LMS 자동전환] {byteCount} byte
                  {isLms && <span className="ml-1 font-medium text-slate-600">(장문)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setMessageEditable((v) => !v)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: BTN_NAVY }}
                >
                  {messageEditable ? "미리보기" : "메시지 내용 수정"}
                </button>
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
                <p className="mb-2 text-xs text-slate-500">
                  필요 시 내용을 수정할 수 있습니다.
                </p>
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
            onClick={handleSend}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: BTN_NAVY }}
          >
            문자 발송하기
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
