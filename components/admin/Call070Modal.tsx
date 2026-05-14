"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { adminFetch } from "@/lib/admin-fetch";
import {
  ADMIN_MODAL_HEADER_BAR_CLASS,
  ADMIN_MODAL_PRIMARY_BTN_CLASS,
  ADMIN_MODAL_CANCEL_BTN_CLASS,
} from "@/lib/admin-dialog-policy";

/**
 * T3-4: 070번호 연결 팝업 (TRD §7.2)
 * 접수: 구글 시트 행 추가 + 슬랙 알림 → 담당자 CallCloud 수동 등록 → 시트 "완료" 시 웹훅으로 DB 동기화
 */

interface Call070Config {
  call_070_number: string;
  greeting_message: string;
  industry: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  sms_text_template: string;
  callcloud_registered?: boolean;
}

interface Props {
  clientId: string;
  clientName: string;
  serviceUrl: string;
  /** 거래처 담당자명 → 관리자명 자동 세팅 */
  contactName?: string;
  /** 거래처 담당자 연락처 → 관리자 전화번호 자동 세팅 */
  contactPhone?: string;
  /** 거래처 담당자 이메일 → 관리자 이메일 자동 세팅 */
  contactEmail?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";
const inputCls =
  "h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#1e293b]";
const readOnlyInputCls = `${inputCls} cursor-not-allowed bg-slate-50`;

export function Call070Modal({
  clientId,
  clientName,
  serviceUrl,
  contactName = "",
  contactPhone = "",
  contactEmail = "",
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<Call070Config>({
    call_070_number: "",
    greeting_message: `안녕하세요 ${clientName}에 전화 주셔서 감사합니다.`,
    industry: "화훼",
    admin_name: "",
    admin_email: "",
    admin_phone: "",
    sms_text_template: `안녕하세요 ${clientName}입니다.`,
  });
  const [requestingQueue, setRequestingQueue] = useState(false);

  useEffect(() => {
    if (!isOpen || !clientId) return;

    async function fetchConfig() {
      const res = await adminFetch(`/api/clients/${clientId}/070`);
      if (res.ok) {
        const data = await res.json();
        const c = data.config;
        const defaultAdminName = c?.admin_name?.trim() || contactName || "";
        const defaultAdminEmail = c?.admin_email?.trim() || contactEmail || "";
        const defaultAdminPhone = c?.admin_phone?.trim() || contactPhone || "";
        if (c) {
          setFormData({
            call_070_number: c.call_070_number || "",
            greeting_message:
              c.greeting_message || `안녕하세요 ${clientName}에 전화 주셔서 감사합니다.`,
            industry: c.industry || "화훼",
            admin_name: defaultAdminName,
            admin_email: defaultAdminEmail,
            admin_phone: defaultAdminPhone,
            sms_text_template:
              c.sms_text_template || `안녕하세요 ${clientName}입니다.`,
            callcloud_registered: c.callcloud_registered || false,
          });
        } else {
          setFormData((prev) => ({
            ...prev,
            admin_name: defaultAdminName,
            admin_email: defaultAdminEmail,
            admin_phone: defaultAdminPhone,
          }));
        }
      }
    }
    void fetchConfig();
  }, [isOpen, clientId, clientName, contactName, contactPhone, contactEmail]);

  const handleRequestQueue = async () => {
    if (!formData.call_070_number?.trim()) {
      alert("서비스 번호(070)는 필수입니다.");
      return;
    }

    if (
      !confirm(
        "070 연동 요청을 접수합니다.\n\n구글 시트에 행이 추가되고 슬랙으로 알림이 갑니다.\n콜게이트 담당자가 CallCloud에 등록한 뒤, 시트에서 진행 상태를 「완료」로 바꾸면 연동 완료로 반영됩니다.\n\n계속할까요?"
      )
    ) {
      return;
    }

    setRequestingQueue(true);

    try {
      const res = await adminFetch(`/api/clients/${clientId}/070/request-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call070Number: formData.call_070_number,
          greetingMessage: formData.greeting_message,
          industry: formData.industry,
          adminName: formData.admin_name,
          adminEmail: formData.admin_email,
          adminPhone: formData.admin_phone,
          smsTextTemplate: formData.sms_text_template,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const rowMsg =
          typeof data.sheetRow === "number"
            ? `\n(시트 행: 약 ${data.sheetRow}번째 줄)`
            : "";
        alert((data.message as string) + rowMsg);
        onSuccess();
        onClose();
        return;
      }

      alert(
        (data.error as string) ||
          `070 연동 요청 처리 실패 (HTTP ${res.status}). 다시 시도하거나 관리자에게 문의해 주세요.`
      );
    } catch (error) {
      console.error("070 request-queue error:", error);
      alert("요청 전송에 실패했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setRequestingQueue(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden bg-white p-0">
        <div className={ADMIN_MODAL_HEADER_BAR_CLASS}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-xl leading-none text-white transition-colors hover:text-slate-200"
            aria-label="닫기"
          >
            ✕
          </button>
          <h2 className="pr-10 text-lg font-bold text-white">070 번호 연동</h2>
        </div>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>
                고객사명 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={clientName}
                readOnly
                className={readOnlyInputCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                서비스 번호 (070) <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.call_070_number}
                onChange={(e) =>
                  setFormData({ ...formData, call_070_number: e.target.value })
                }
                required
                placeholder="07012341234 (하이픈 없이)"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>인사말 멘트</label>
              <input
                type="text"
                value={formData.greeting_message}
                onChange={(e) =>
                  setFormData({ ...formData, greeting_message: e.target.value })
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>고객사 대표번호</label>
              <input
                type="text"
                value={formData.call_070_number}
                readOnly
                className={readOnlyInputCls}
              />
              <p className="mt-1 text-xs text-slate-500">
                서비스 번호와 동일하게 적용됩니다.
              </p>
            </div>

            <div>
              <label className={labelCls}>업종</label>
              <select
                value={formData.industry}
                onChange={(e) =>
                  setFormData({ ...formData, industry: e.target.value })
                }
                className={inputCls}
              >
                <option value="화훼">화훼</option>
                <option value="제조">제조</option>
                <option value="도소매">도소매</option>
                <option value="서비스">서비스</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>관리자명</label>
                <input
                  type="text"
                  value={formData.admin_name}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_name: e.target.value })
                  }
                  placeholder="홍길동"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>관리자 이메일</label>
                <input
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_email: e.target.value })
                  }
                  placeholder="hong@gmail.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>관리자 전화번호</label>
                <input
                  type="tel"
                  value={formData.admin_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, admin_phone: e.target.value })
                  }
                  placeholder="01012344321"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                서비스 URL <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={serviceUrl}
                readOnly
                className={`${readOnlyInputCls} font-mono text-sm`}
              />
              <p className="mt-1 text-xs text-slate-500">
                거래처 전용 URL이 자동으로 입력됩니다.
              </p>
            </div>

            <div>
              <label className={labelCls}>SMS 텍스트</label>
              <textarea
                value={formData.sms_text_template}
                onChange={(e) =>
                  setFormData({ ...formData, sms_text_template: e.target.value })
                }
                rows={3}
                className={`min-h-[5rem] w-full resize-y ${inputCls}`}
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <button type="button" onClick={onClose} className={ADMIN_MODAL_CANCEL_BTN_CLASS}>
            취소
          </button>
          {!formData.callcloud_registered ? (
            <button
              type="button"
              onClick={() => void handleRequestQueue()}
              disabled={requestingQueue}
              className={`${ADMIN_MODAL_PRIMARY_BTN_CLASS} whitespace-nowrap px-5`}
            >
              {requestingQueue ? "접수 중…" : "070 연동 요청"}
            </button>
          ) : (
            <div className="flex items-center whitespace-nowrap rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white">
              ✓ CallCloud 연동 완료
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
