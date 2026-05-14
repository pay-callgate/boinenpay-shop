"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

const inputClass =
  "block h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm focus:border-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#1e293b]";
const labelClass = "mb-1 block text-xs font-semibold text-slate-700";
const sectionTitleClass = "text-sm font-semibold text-slate-800";
const cardClass =
  "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";

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

  const [postcodeLoaded, setPostcodeLoaded] = useState(false);
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

  const handleBusinessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBusiness((prev) => ({ ...prev, [name]: value }));
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setContact((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/") || !partnerId) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "Partners");
      fd.append("partnerId", partnerId);
      const res = await adminFetch("/api/upload/image", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data?.url) {
        setLogoUrl(data.url);
        setLogoPreview(data.url);
      } else {
        alert(data?.error ?? "로고 업로드에 실패했습니다.");
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
    if (typeof window === "undefined") return;
    const w = window as unknown as { daum?: { Postcode: new (opts: unknown) => { open: () => void } } };

    const openPostcode = () => {
      if (!w.daum?.Postcode) return;
      new w.daum.Postcode({
        oncomplete: (data: {
          zonecode?: string;
          roadAddress?: string;
          jibunAddress?: string;
        }) => {
          setContact((prev) => ({
            ...prev,
            zipcode: data.zonecode ?? "",
            basicAddress: data.roadAddress || data.jibunAddress || "",
            detailAddress: "",
          }));
        },
      }).open();
    };

    if (w.daum?.Postcode) {
      openPostcode();
      return;
    }

    if (!postcodeLoaded) {
      const script = document.createElement("script");
      script.src =
        "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      script.onload = () => {
        setPostcodeLoaded(true);
        openPostcode();
      };
      document.body.appendChild(script);
    }
  };

  const handleSave = async () => {
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden bg-white p-0">
        <div className={ADMIN_MODAL_HEADER_BAR_CLASS}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-xl leading-none text-white transition-colors hover:text-slate-200"
            aria-label="닫기"
          >
            ✕
          </button>
          <h2 className="pr-10 text-lg font-bold text-white">파트너 설정</h2>
          <p className="mt-1 text-sm text-slate-300">
            파트너사의 브랜드 로고 및 사업자 정보를 관리합니다.
          </p>
        </div>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
          <div className="flex flex-col gap-4">
            {/* 브랜드 — 가로 배치 */}
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-3`}>브랜드 설정</h3>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoFile}
              />
              <div className="flex flex-wrap items-start gap-4">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="cursor-pointer shrink-0 rounded-lg border border-transparent p-0 text-left transition hover:opacity-90"
                >
                  <div className="flex h-24 w-24 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-slate-400 hover:bg-slate-100">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="로고 미리보기"
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    ) : (
                      <>
                        <span className="text-2xl" aria-hidden>
                          🖼️
                        </span>
                        <span className="mt-1 px-1 text-center text-[10px] leading-tight">
                          클릭하여 업로드
                        </span>
                      </>
                    )}
                  </div>
                </button>
                <div className="flex min-w-[7.5rem] flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading || !partnerId}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {logoUploading ? "업로드 중…" : "로고 변경"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    로고 삭제
                  </button>
                </div>
                <p className="min-w-0 max-w-md flex-1 text-xs leading-relaxed text-slate-500">
                  권장: PNG·JPG, 정사각형에 가깝게. 업로드 즉시 미리보기에 반영됩니다.
                </p>
              </div>
            </div>

            {/* 사업자 정보 — 2열 그리드 */}
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-3`}>사업자 정보</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-x-4">
                <div>
                  <label className={labelClass}>사업자명</label>
                  <input
                    type="text"
                    name="companyName"
                    value={business.companyName}
                    onChange={handleBusinessChange}
                    placeholder="사업자명 입력"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>사업자등록번호</label>
                  <input
                    type="text"
                    name="businessRegistrationNumber"
                    value={business.businessRegistrationNumber}
                    onChange={handleBusinessChange}
                    placeholder="000-00-00000"
                    maxLength={12}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>법인등록번호</label>
                  <input
                    type="text"
                    name="corporateRegistrationNumber"
                    value={business.corporateRegistrationNumber}
                    onChange={handleBusinessChange}
                    placeholder="000000-0000000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>업태</label>
                  <input
                    type="text"
                    name="businessType"
                    value={business.businessType}
                    onChange={handleBusinessChange}
                    placeholder="예: 도소매업"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>업종</label>
                  <input
                    type="text"
                    name="businessCategory"
                    value={business.businessCategory}
                    onChange={handleBusinessChange}
                    placeholder="예: 외식업"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* 담당자·주소 */}
            <div className={cardClass}>
              <h3 className={`${sectionTitleClass} mb-3`}>담당자 및 주소</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-x-4">
                <div>
                  <label className={labelClass}>대표자명</label>
                  <input
                    type="text"
                    name="representative"
                    value={contact.representative}
                    onChange={handleContactChange}
                    placeholder="대표자명"
                    className={inputClass}
                  />
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
                  <input
                    type="email"
                    name="email"
                    value={contact.email}
                    onChange={handleContactChange}
                    placeholder="example@email.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>연락처</label>
                  <input
                    type="tel"
                    name="contact"
                    value={contact.contact}
                    onChange={handleContactChange}
                    placeholder="010-0000-0000"
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>사업장 주소지</label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      name="zipcode"
                      value={contact.zipcode}
                      readOnly
                      placeholder="우편번호"
                      className={`${inputClass} sm:max-w-[9rem]`}
                      aria-label="우편번호"
                    />
                    <button
                      type="button"
                      onClick={handleSearchAddress}
                      className="h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      우편번호 찾기
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-[11px] font-medium text-slate-600">
                        기본 주소
                      </span>
                      <input
                        type="text"
                        name="basicAddress"
                        value={contact.basicAddress}
                        readOnly
                        placeholder="기본 주소"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-[11px] font-medium text-slate-600">
                        상세 주소
                      </span>
                      <input
                        type="text"
                        name="detailAddress"
                        value={contact.detailAddress}
                        onChange={handleContactChange}
                        placeholder="상세 주소"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className={`${ADMIN_MODAL_PRIMARY_BTN_CLASS} min-w-[5.5rem] font-semibold`}
          >
            {saving ? "저장 중…" : "수정"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
