"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Briefcase,
  FileText,
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
import { adminFetch } from "@/lib/admin-fetch";
import { postAdminImageUpload } from "@/lib/admin-upload-image";
import {
  ADMIN_MODAL_PRIMARY_BTN_CLASS,
  ADMIN_MODAL_CANCEL_BTN_CLASS,
} from "@/lib/admin-dialog-policy";

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
    <section className={`py-6 ${isLast ? "" : "border-b border-gray-200"}`}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PartnerSettingsModal({ open, onClose }: Props) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [business, setBusiness] = useState({
    companyName: "",
    businessRegistrationNumber: "",
    corporateRegistrationNumber: "",
    businessType: "",
    businessCategory: "",
  });

  const [contact, setContact] = useState({
    representative: "",
    representativeDob: "",
    email: "",
    contact: "",
    zipcode: "",
    basicAddress: "",
    detailAddress: "",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function fetchPartner() {
      try {
        const res = await adminFetch("/api/partner");
        if (!res.ok) return;
        const result = await res.json();
        const partner = result?.data;
        if (!partner || cancelled) return;

        setPartnerId(partner.id);
        const logo = partner.logo_url as string | null;
        setLogoUrl(logo || null);
        setLogoPreview(logo || null);

        setBusiness({
          companyName: partner.company_name ?? "",
          businessRegistrationNumber:
            (partner.business_registration_number as string) ?? "",
          corporateRegistrationNumber:
            (partner.corporate_registration_number as string) ?? "",
          businessType: (partner.business_type as string) ?? "",
          businessCategory: (partner.business_category as string) ?? "",
        });

        setContact((prev) => ({
          ...prev,
          representative: (partner.representative as string) ?? "",
          representativeDob: (partner.representative_dob as string) ?? "",
          email: (partner.email as string) ?? "",
          contact: (partner.contact as string) ?? "",
          zipcode: (partner.postcode as string) ?? "",
          basicAddress: (partner.address as string) ?? "",
          detailAddress: "",
        }));
      } catch {
        // ignore
      }
    }
    void fetchPartner();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleBusinessChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBusiness((prev) => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setContact((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "Partners");
      fd.append("partnerId", partnerId);
      const result = await postAdminImageUpload(fd);
      if (result.ok) {
        setLogoUrl(result.url);
        setLogoPreview(result.url);
      } else {
        alert(result.error);
      }
    } catch {
      alert("로고 업로드 중 오류가 발생했습니다.");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
  };

  const handleSearchAddress = () => {
    openDaumPostcode(
      ({ zonecode, address }) => {
        setContact((prev) => ({
          ...prev,
          zipcode: zonecode ?? "",
          basicAddress: address ?? prev.basicAddress,
          detailAddress: "",
        }));
      },
      (msg) => alert(msg)
    );
  };

  const handleSave = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const address =
        [contact.basicAddress, contact.detailAddress].filter(Boolean).join(" ") ||
        "";
      const res = await adminFetch("/api/partner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: business.companyName,
          business_registration_number: business.businessRegistrationNumber,
          corporate_registration_number:
            business.corporateRegistrationNumber || null,
          business_type: business.businessType || null,
          business_category: business.businessCategory || null,
          representative: contact.representative,
          representative_dob: contact.representativeDob || null,
          email: contact.email,
          contact: contact.contact || null,
          postcode: contact.zipcode || null,
          address: address || null,
          logo_url: logoUrl || null,
        }),
      });
      const result = await res.json();
      if (res.ok && result?.success) {
        alert("파트너 정보가 수정되었습니다.");
        router.refresh();
      } else {
        alert(result?.error?.message ?? "수정에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "h-10 w-full rounded-md border border-gray-200 bg-slate-50 px-3 text-sm text-slate-900 shadow-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10";
  const inputWithIconClass = `${inputClass} pl-9`;
  const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

  const logoBoxButtonClass =
    "relative flex h-20 w-40 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-dashed border-gray-300 bg-slate-50/80 text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>파트너 설정</DialogTitle>
          <p className="mt-1 text-sm text-slate-300">
            파트너사의 브랜드 로고 및 사업자 정보를 관리합니다.
          </p>
          <DialogClose />
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-white">
          <form
            id="partner-settings-form"
            className="px-6 pb-1"
            onSubmit={(ev) => void handleSave(ev)}
          >
            <FormSection title="브랜드 설정">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="flex shrink-0 flex-col items-center gap-1 sm:items-stretch">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoUploading}
                    onChange={handleLogoFile}
                  />
                  <button
                    type="button"
                    className={`${logoBoxButtonClass} mx-auto sm:mx-0`}
                    disabled={logoUploading || !partnerId}
                    onClick={() => logoInputRef.current?.click()}
                    aria-label="파트너 로고 업로드"
                  >
                    {logoPreview ? (
                      <span className="flex size-full items-center justify-center bg-white p-2">
                        <img
                          src={logoPreview}
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
                  {logoPreview ? (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
                <div className="min-w-0 w-full max-w-md">
                  <label className={labelClass} htmlFor="partner-company-name">
                    사업자명
                  </label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Building2 />
                    </InputLeadingIcon>
                    <input
                      id="partner-company-name"
                      type="text"
                      name="companyName"
                      value={business.companyName}
                      onChange={handleBusinessChange}
                      placeholder="공식 사업자명을 입력해 주세요"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection title="사업자 정보">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label className={labelClass}>사업자등록번호</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Building2 />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      name="businessRegistrationNumber"
                      value={business.businessRegistrationNumber}
                      onChange={handleBusinessChange}
                      placeholder="000-00-00000"
                      maxLength={12}
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>법인등록번호</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <FileText />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      name="corporateRegistrationNumber"
                      value={business.corporateRegistrationNumber}
                      onChange={handleBusinessChange}
                      placeholder="000000-0000000"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>업태</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Briefcase />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      name="businessType"
                      value={business.businessType}
                      onChange={handleBusinessChange}
                      placeholder="예: 도소매업"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>업종</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Building2 />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      name="businessCategory"
                      value={business.businessCategory}
                      onChange={handleBusinessChange}
                      placeholder="예: 도매 및 소매업"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection title="담당자 정보">
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label className={labelClass}>대표자명</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <User />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      name="representative"
                      value={contact.representative}
                      onChange={handleContactChange}
                      placeholder="대표자명"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>생년월일</label>
                  <input
                    type="date"
                    name="representativeDob"
                    value={contact.representativeDob}
                    onChange={handleContactChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>이메일</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Mail />
                    </InputLeadingIcon>
                    <input
                      type="email"
                      name="email"
                      value={contact.email}
                      onChange={handleContactChange}
                      placeholder="example@email.com"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>연락처</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <Phone />
                    </InputLeadingIcon>
                    <input
                      type="tel"
                      name="contact"
                      value={contact.contact}
                      onChange={handleContactChange}
                      placeholder="010-0000-0000"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection title="주소 정보" isLast>
              <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end md:gap-x-3 md:gap-y-0">
                <div className="min-w-0">
                  <label className={labelClass}>기본 주소</label>
                  <div className="relative">
                    <InputLeadingIcon>
                      <MapPin />
                    </InputLeadingIcon>
                    <input
                      type="text"
                      name="basicAddress"
                      value={contact.basicAddress}
                      onChange={handleContactChange}
                      placeholder="도로명 또는 지번 주소"
                      className={inputWithIconClass}
                    />
                  </div>
                </div>
                <div className="min-w-0 md:max-w-full">
                  <label className={labelClass}>상세 주소</label>
                  <input
                    type="text"
                    name="detailAddress"
                    value={contact.detailAddress}
                    onChange={handleContactChange}
                    className={inputClass}
                    placeholder="동·호수 등"
                  />
                </div>
                <div className="flex md:items-end">
                  <button
                    type="button"
                    onClick={handleSearchAddress}
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
            disabled={saving}
            className={ADMIN_MODAL_CANCEL_BTN_CLASS}
          >
            닫기
          </button>
          <button
            type="submit"
            form="partner-settings-form"
            disabled={saving}
            className={`${ADMIN_MODAL_PRIMARY_BTN_CLASS} min-w-[5.5rem] font-semibold whitespace-nowrap`}
          >
            {saving ? "저장 중…" : "수정"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
