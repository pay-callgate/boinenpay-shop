"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Camera } from "lucide-react";
import { openDaumPostcode } from "@/lib/daum-postcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ADMIN_MODAL_CANCEL_BTN_CLASS,
  ADMIN_MODAL_PRIMARY_BTN_CLASS,
} from "@/lib/admin-dialog-policy";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * 거래처 등록/수정 모달
 * ProductRegistrationModal 디자인 참고, 2열 그리드 텍스트 필드
 */

export interface ClientInitialData {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  business_registration_number?: string | null;
  verification_status?: string;
  representative_name?: string | null;
  representative_email?: string | null;
  representative_phone?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  zip_code?: string | null;
  address?: string | null;
  address_detail?: string | null;
}

interface ClientRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string | null;
  subdomain: string;
  initialData?: ClientInitialData | null;
  onSuccess?: () => void;
}

/** 섹션 래퍼: 박스 없음, 구분선 + 세로 여백만 */
function FormSection({
  title,
  children,
  isLast,
}: {
  title: string;
  children: ReactNode;
  isLast?: boolean;
}) {
  return (
    <section
      className={`py-4 ${isLast ? "" : "border-b border-gray-200"}`}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ClientRegistrationModal({
  open,
  onOpenChange,
  partnerId,
  subdomain: _subdomain,
  initialData = null,
  onSuccess,
}: ClientRegistrationModalProps) {
  void _subdomain;
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    businessRegistrationNumber: "",
    representativeName: "",
    businessType: "",
    representativeEmail: "",
    representativePhone: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    zipCode: "",
    address: "",
    addressDetail: "",
    verificationStatus: "pending",
  });
  const [logoUploading, setLogoUploading] = useState(false);

  const openPostcodeSearch = () => {
    openDaumPostcode(
      ({ zonecode, address }) => {
        setFormData((prev) => ({
          ...prev,
          zipCode: zonecode ?? "",
          address: address ?? prev.address,
        }));
      },
      (msg) => alert(msg)
    );
  };

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setFormData({
        name: initialData.name,
        slug: initialData.slug,
        logoUrl: initialData.logo_url ?? "",
        businessRegistrationNumber: initialData.business_registration_number ?? "",
        representativeName: initialData.representative_name ?? "",
        businessType: "",
        representativeEmail: initialData.representative_email ?? "",
        representativePhone: initialData.representative_phone ?? "",
        contactName: initialData.contact_name ?? "",
        contactPhone: initialData.contact_phone ?? "",
        contactEmail: initialData.contact_email ?? "",
        zipCode: initialData.zip_code ?? "",
        address: initialData.address ?? "",
        addressDetail: initialData.address_detail ?? "",
        verificationStatus: initialData.verification_status ?? "pending",
      });
    } else {
      setFormData({
        name: "",
        slug: "",
        logoUrl: "",
        businessRegistrationNumber: "",
        representativeName: "",
        businessType: "",
        representativeEmail: "",
        representativePhone: "",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        zipCode: "",
        address: "",
        addressDetail: "",
        verificationStatus: "pending",
      });
    }
  }, [open, initialData]);

  const onClose = () => {
    onOpenChange(false);
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "clients");
      fd.append("partnerId", partnerId);
      if (initialData?.id) fd.append("entityId", initialData.id);
      const res = await adminFetch("/api/upload/image", { method: "POST", body: fd });
      const data = await res.json();
      if (data?.url) setFormData((prev) => ({ ...prev, logoUrl: data.url }));
      else alert(data?.error || "로고 업로드에 실패했습니다.");
    } catch {
      alert("로고 업로드 중 오류가 발생했습니다.");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId || !formData.name.trim() || !formData.slug.trim()) return;

    setSaving(true);
    try {
      const url = initialData ? `/api/clients/${initialData.id}` : "/api/clients";
      const method = initialData ? "PUT" : "POST";
      const body = initialData
        ? {
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            logoUrl: formData.logoUrl.trim() || null,
            businessRegistrationNumber: formData.businessRegistrationNumber || null,
            verificationStatus: formData.verificationStatus,
            representativeName: formData.representativeName.trim() || null,
            representativeEmail: formData.representativeEmail.trim() || null,
            representativePhone: formData.representativePhone.trim() || null,
            contactName: formData.contactName || null,
            contactPhone: formData.contactPhone || null,
            contactEmail: formData.contactEmail || null,
            zipCode: formData.zipCode.trim() || null,
            address: formData.address.trim() || null,
            addressDetail: formData.addressDetail.trim() || null,
          }
        : {
            partnerId,
            name: formData.name.trim(),
            slug: formData.slug.trim(),
            logoUrl: formData.logoUrl.trim() || null,
            businessRegistrationNumber: formData.businessRegistrationNumber || null,
            verificationStatus: formData.verificationStatus,
            representativeName: formData.representativeName.trim() || null,
            representativeEmail: formData.representativeEmail.trim() || null,
            representativePhone: formData.representativePhone.trim() || null,
            contactName: formData.contactName || null,
            contactPhone: formData.contactPhone || null,
            contactEmail: formData.contactEmail || null,
            zipCode: formData.zipCode.trim() || null,
            address: formData.address.trim() || null,
            addressDetail: formData.addressDetail.trim() || null,
          };

      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSuccess?.();
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || (initialData ? "거래처 수정에 실패했습니다." : "거래처 등록에 실패했습니다."));
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "h-8 w-full rounded border border-slate-300 px-2 text-[13px] leading-tight focus:border-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#1e293b]";
  const labelClass = "mb-1 block text-xs font-semibold text-slate-700";

  const logoBoxButtonClass =
    "relative flex h-28 w-32 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{initialData ? "거래처 수정" : "거래처 등록"}</DialogTitle>
          <p className="mt-1 text-sm text-slate-300">
            {initialData ? "거래처 정보를 수정한 뒤 저장하세요." : "새 거래처 정보를 입력하세요."}
          </p>
          <DialogClose />
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-white">
          <form id="client-reg-form" onSubmit={handleSubmit} className="px-6 pb-1">
            <FormSection title="기본 정보">
              <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                <div className="col-span-2 flex items-end gap-6">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoUploading}
                    onChange={handleLogoFileChange}
                  />
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <button
                      type="button"
                      className={logoBoxButtonClass}
                      disabled={logoUploading || !partnerId}
                      onClick={() => logoInputRef.current?.click()}
                      aria-label="거래처 로고 업로드"
                    >
                      {formData.logoUrl ? (
                        <img
                          src={formData.logoUrl}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <Camera className="h-7 w-7" aria-hidden />
                      )}
                    </button>
                    {formData.logoUrl ? (
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, logoUrl: "" }))}
                        className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                      >
                        삭제
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">로고</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pl-2 sm:pl-5">
                    <label className={labelClass} htmlFor="client-reg-name">
                      거래처명 *
                    </label>
                    <input
                      id="client-reg-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={inputClass}
                      placeholder="거래처명 입력"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Slug (URL용) *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className={inputClass}
                    placeholder="예: abc-company"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>사업자등록번호</label>
                  <input
                    type="text"
                    value={formData.businessRegistrationNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, businessRegistrationNumber: e.target.value })
                    }
                    className={inputClass}
                    placeholder="000-00-00000"
                  />
                </div>
                <div>
                  <label className={labelClass}>대표자명</label>
                  <input
                    type="text"
                    value={formData.representativeName}
                    onChange={(e) =>
                      setFormData({ ...formData, representativeName: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>업태/종목</label>
                  <input
                    type="text"
                    value={formData.businessType}
                    onChange={(e) =>
                      setFormData({ ...formData, businessType: e.target.value })
                    }
                    className={inputClass}
                    placeholder="예: 도소매 / 꽃 판매"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="연락처/담당자 정보">
              <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                <div>
                  <label className={labelClass}>담당자명</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) =>
                      setFormData({ ...formData, contactName: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>담당자 연락처</label>
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, contactPhone: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>담당자 이메일</label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, contactEmail: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>회사 대표 연락처</label>
                  <input
                    type="tel"
                    value={formData.representativePhone}
                    onChange={(e) =>
                      setFormData({ ...formData, representativePhone: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>회사 대표 이메일</label>
                  <input
                    type="email"
                    value={formData.representativeEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, representativeEmail: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="주소 정보" isLast>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                <div className="col-span-2 flex flex-wrap items-end gap-2">
                  <div className="w-28">
                    <label className={labelClass}>우편번호</label>
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) =>
                        setFormData({ ...formData, zipCode: e.target.value })
                      }
                      className={inputClass}
                      placeholder="우편번호"
                      readOnly
                    />
                  </div>
                  <button
                    type="button"
                    onClick={openPostcodeSearch}
                    className="mb-0.5 h-8 shrink-0 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    우편번호 찾기
                  </button>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>기본 주소</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelClass}>상세 주소</label>
                  <input
                    type="text"
                    value={formData.addressDetail}
                    onChange={(e) =>
                      setFormData({ ...formData, addressDetail: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </FormSection>
          </form>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className={ADMIN_MODAL_CANCEL_BTN_CLASS}
          >
            취소
          </button>
          <button
            type="submit"
            form="client-reg-form"
            disabled={saving}
            className={`${ADMIN_MODAL_PRIMARY_BTN_CLASS} whitespace-nowrap`}
          >
            {initialData ? "수정 저장" : "거래처 등록"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
