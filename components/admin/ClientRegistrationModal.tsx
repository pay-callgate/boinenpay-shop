"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import {
  Building2,
  Link2,
  Mail,
  MapPin,
  Phone,
  Upload,
  User,
} from "lucide-react";
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

/** 인풃 좌측 아이콘 (참고 UI: 16px 느낌 라인 아이콘) */
function InputLeadingIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 [&_svg]:size-4"
      aria-hidden
    >
      {children}
    </span>
  );
}

/** 섹션 래퍼: 박스 없음, 얇은 구분선 + 세로 여백만 (SaaS 폼 톤) */
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
      className={`py-6 ${isLast ? "" : "border-b border-gray-200"}`}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
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

  /** 플랫 SaaS형: 은은한 필 배경(slate-50), 얇은 테두리, 약한 포커스 링 */
  const inputClass =
    "h-10 w-full rounded-md border border-gray-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10";
  const inputWithIconClass = `${inputClass} pl-9`;
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

  /** 거래처 로고: 가로 2배 와이드 사각 박스(점선 테두리) */
  const logoBoxButtonClass =
    "relative flex h-20 w-40 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-slate-50/80 text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

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
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                {/* Row 1: 아바타 + 거래처명 (전체 폭) */}
                <div className="col-span-2 flex items-center gap-4">
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
                        <span className="flex size-full items-center justify-center bg-white p-2">
                          <img
                            src={formData.logoUrl}
                            alt=""
                            className="h-auto w-auto max-h-full max-w-full object-contain object-center"
                            decoding="async"
                          />
                        </span>
                      ) : (
                        <>
                          <Upload className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                          <span className="text-[10px] font-medium leading-none">로고</span>
                        </>
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
                    ) : null}
                  </div>
                  <div className="min-w-0 max-w-md flex-1">
                    <label className={labelClass} htmlFor="client-reg-name">
                      거래처명 <span className="font-semibold text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <InputLeadingIcon>
                        <Building2 />
                      </InputLeadingIcon>
                      <input
                        id="client-reg-name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputWithIconClass}
                        placeholder="공식 회사명을 입력해 주세요"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>
                    Slug (URL용) <span className="font-semibold text-red-500">*</span>
                  </label>
                  <div className="flex h-10 w-full overflow-hidden rounded-md border border-gray-200 bg-slate-50 shadow-none focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-900/10">
                    <span className="flex shrink-0 items-center border-r border-gray-200 bg-slate-100/80 px-2.5 text-xs font-medium tabular-nums text-slate-500">
                      /c/
                    </span>
                    <div className="relative min-w-0 flex-1">
                      <InputLeadingIcon>
                        <Link2 />
                      </InputLeadingIcon>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        className="h-full w-full min-w-0 border-0 bg-transparent py-0 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                        placeholder="company-identifier"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>사업자등록번호</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Building2 />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      value={formData.businessRegistrationNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, businessRegistrationNumber: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="000-00-00000"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>대표자명</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <User />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      value={formData.representativeName}
                      onChange={(e) =>
                        setFormData({ ...formData, representativeName: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="홍길동"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>업태 / 종목</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Building2 />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      value={formData.businessType}
                      onChange={(e) =>
                        setFormData({ ...formData, businessType: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="서비스 / 소프트웨어 개발"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection title="연락처 / 담당자 정보">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label className={labelClass}>담당자명</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <User />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) =>
                        setFormData({ ...formData, contactName: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="담당자 이름"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>담당자 연락처</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Phone />
                    </InputLeadingIcon>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, contactPhone: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>담당자 이메일</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Mail />
                    </InputLeadingIcon>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, contactEmail: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="manager@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>회사 대표 연락처</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Phone />
                    </InputLeadingIcon>
                    <input
                      type="tel"
                      value={formData.representativePhone}
                      onChange={(e) =>
                        setFormData({ ...formData, representativePhone: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="02-1234-5678"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>회사 대표 이메일</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Mail />
                    </InputLeadingIcon>
                    <input
                      type="email"
                      value={formData.representativeEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, representativeEmail: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="contact@company.com"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection title="주소 정보" isLast>
              {/*
                한 줄: 기본 주소 → 상세 주소 → 우편번호 찾기.
                우편번호는 검색 시 state에만 저장하고 화면에는 표시하지 않음.
              */}
              <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end md:gap-x-3 md:gap-y-0">
                <div className="min-w-0">
                  <label className={labelClass}>기본 주소</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <MapPin />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      className={inputWithIconClass}
                      placeholder="도로명 또는 지번 주소"
                    />
                  </div>
                </div>
                <div className="min-w-0 md:max-w-full">
                  <label className={labelClass}>상세 주소</label>
                  <input
                    type="text"
                    value={formData.addressDetail}
                    onChange={(e) =>
                      setFormData({ ...formData, addressDetail: e.target.value })
                    }
                    className={inputClass}
                    placeholder="동·호수 등"
                  />
                </div>
                <div className="flex md:items-end">
                  <button
                    type="button"
                    onClick={openPostcodeSearch}
                    className={`inline-flex h-10 w-full shrink-0 items-center justify-center ${ADMIN_MODAL_PRIMARY_BTN_CLASS} md:w-auto`}
                  >
                    우편번호 찾기
                  </button>
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
