"use client";

import {
  Dialog,
  DialogContent,
  DialogBody,
} from "@/components/ui/dialog";

const HEADER_BG = "bg-[#1A2234]";

function getByteCount(text: string): number {
  return new TextEncoder().encode(text).length;
}

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  body: string;
  senderPhone: string;
  receiverPhone: string;
}

/**
 * LinkNotificationModal 과 동일한 헤더·미리보기 레이아웃, 발송 내역용 읽기 전용.
 */
export function AlimtalkHistoryDetailModal({
  isOpen,
  onClose,
  title,
  body,
  senderPhone,
  receiverPhone,
}: Props) {
  const byteCount = getByteCount(body);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden bg-white p-0">
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
            발송된 알림톡 본문을 확인합니다. (읽기 전용)
          </p>
        </div>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
          <p className="mb-4 text-sm font-semibold text-gray-900">{title}</p>
          <div className="grid min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:min-h-[420px]">
            <div className="flex flex-col gap-6 lg:col-span-5">
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-900">
                  알림톡 미리보기
                </h3>
                <div
                  className="flex min-h-[280px] max-h-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-[#f3f4f6] shadow-sm"
                  style={{ boxShadow: "inset 0 0 16px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex shrink-0 justify-center border-b border-gray-200/80 py-2">
                    <div className="h-4 w-12 rounded-full bg-gray-300" />
                  </div>
                  <div className="min-h-[200px] min-w-0 flex-1 overflow-y-auto p-4">
                    <div className="min-w-0 max-w-full rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                      <p className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 [overflow-wrap:anywhere]">
                        {body || "내용 없음"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

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
                  [알림톡 본문] {body.length}자 · {byteCount} byte (매뉴얼 기준 MSG
                  최대 1000자)
                </p>
              </div>
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
                  value={formatPhoneDisplay(receiverPhone)}
                  className={inputReadOnly}
                />
              </div>
            </div>
          </div>
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
