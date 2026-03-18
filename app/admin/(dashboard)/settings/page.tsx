"use client";

import React, { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * 파트너 설정 전용 페이지
 * /admin/settings — 로고(CI), 사업자 정보, 담당자·주소
 */

const inputClass =
  "block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700";
const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";

export default function AdminSettingsPage() {
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

  // 로그인된 파트너 정보 조회 → 초기 값 세팅
  useEffect(() => {
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
        // 무시: 설정 페이지 초기 로딩 실패는 치명적이지 않음
      }
    }
    fetchPartner();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const res = await adminFetch("/api/upload/image", { method: "POST", body: fd });
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
    const w = window as unknown as { daum?: any };

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
    // 로딩 중일 때는 별도 처리 없음
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const address = [contact.basicAddress, contact.detailAddress].filter(Boolean).join(" ") || "";
      const res = await adminFetch("/api/partner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: business.companyName,
          business_registration_number: business.businessRegistrationNumber,
          corporate_registration_number: business.corporateRegistrationNumber || null,
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
    <div className="min-h-full w-full bg-[#F5F7FA]">
      {/* [1] 상단 타이틀 영역 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">파트너 설정</h2>
        <p className="mt-1 text-sm text-slate-600">
          파트너사의 브랜드 로고 및 사업자 정보를 관리합니다.
        </p>
      </div>

      {/* [2] 1:2 비율 Grid: 좌측 브랜드 설정(1) / 우측 입력(2) */}
      <div className="grid max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 좌측: 브랜드 설정 카드 */}
        <div className="rounded-lg bg-white p-6 shadow-sm lg:col-span-1">
          <h3 className="mb-4 text-base font-semibold text-slate-800">
            브랜드 설정
          </h3>
          <input
            id="logo-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoFile}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
            <div className="flex shrink-0 flex-col items-center">
              <label htmlFor="logo-file" className="cursor-pointer">
                <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-slate-400 hover:bg-gray-100 sm:h-32 sm:w-32">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="로고 미리보기"
                      className="h-full w-full rounded-lg object-contain p-1"
                    />
                  ) : (
                    <>
                      <span className="text-2xl sm:text-3xl">🖼️</span>
                      <span className="mt-1 text-xs sm:mt-2">클릭하여 업로드</span>
                      <span className="text-xs">또는 드래그</span>
                    </>
                  )}
                </div>
              </label>
            </div>
            <div className="flex flex-col gap-2 sm:justify-center">
              <button
                type="button"
                onClick={() => document.getElementById("logo-file")?.click()}
                disabled={logoUploading || !partnerId}
                className="rounded border border-slate-600 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {logoUploading ? "업로드 중..." : "로고 변경"}
              </button>
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                로고 삭제
              </button>
            </div>
          </div>
        </div>

        {/* 우측: 사업자 정보 + 담당자 및 주소 (세로 배치) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* 카드: 사업자 정보 */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              사업자 정보
            </h3>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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

          {/* 카드: 담당자 및 주소 */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              담당자 및 주소
            </h3>
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-3">
                  {/* 1단: 우편번호 + 버튼 */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="sm:max-w-[200px] w-full">
                      <label className="sr-only">우편번호</label>
                      <input
                        type="text"
                        name="zipcode"
                        value={contact.zipcode}
                        readOnly
                        placeholder="우편번호"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchAddress}
                      className="h-10 rounded border border-slate-300 bg-white px-4 text-sm font-medium text-blue-600 hover:bg-slate-50"
                    >
                      우편번호 찾기
                    </button>
                  </div>

                  {/* 2·3단: 기본 주소 / 상세 주소 나란히 */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        기본 주소
                      </label>
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
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        상세 주소
                      </label>
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
                {/* 카드 하단 저장 버튼 */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? "저장 중..." : "수정"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="pb-16" />
    </div>
  );
}
