"use client";

import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUS_OPTIONS = [
  { value: "pending", label: "심사중" },
  { value: "verified", label: "정상" },
  { value: "rejected", label: "중지" },
] as const;

export function ClientRegistrationModal({
  open,
  onOpenChange,
  partnerId,
  subdomain,
  initialData = null,
  onSuccess,
}: ClientRegistrationModalProps) {
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
    calllinkId: "",
    commissionRate: "",
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
        representativeName: "",
        businessType: "",
        representativeEmail: "",
        representativePhone: "",
        contactName: initialData.contact_name ?? "",
        contactPhone: initialData.contact_phone ?? "",
        contactEmail: initialData.contact_email ?? "",
        zipCode: initialData.zip_code ?? "",
        address: initialData.address ?? "",
        addressDetail: initialData.address_detail ?? "",
        calllinkId: "",
        commissionRate: "",
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
        calllinkId: "",
        commissionRate: "",
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
    "h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
  const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
  const selectClass =
    "h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex max-h-[90vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{initialData ? "거래처 수정" : "거래처 등록"}</DialogTitle>
          <p className="mt-1 text-sm text-slate-300">
            {initialData ? "거래처 정보를 수정한 뒤 저장하세요." : "새 거래처 정보를 입력하세요."}
          </p>
          <DialogClose />
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0 overflow-y-auto">
          <form id="client-reg-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-6 p-6">
              {/* 기본 정보 */}
              <Card className="col-span-2 border-none bg-transparent shadow-none">
                <CardHeader className="p-0 pb-2 mb-4 border-b border-slate-100">
                  <CardTitle className="text-base">기본 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  {/* 거래처 로고 (Avatar Upload Style: 좌 미리보기 / 우 컨트롤) */}
                  <div className="col-span-2">
                    <label className={labelClass}>거래처 로고</label>
                    <div className="flex items-center gap-5">
                      <div className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 bg-slate-50 object-contain shadow-sm overflow-hidden flex items-center justify-center">
                        {formData.logoUrl ? (
                          <img
                            src={formData.logoUrl}
                            alt="로고 미리보기"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Camera className="h-8 w-8 text-slate-300" aria-hidden />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <label className="cursor-pointer inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 w-fit">
                          {logoUploading ? "업로드 중..." : "이미지 선택"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={logoUploading}
                            onChange={handleLogoFileChange}
                          />
                        </label>
                        {formData.logoUrl ? (
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, logoUrl: "" }))}
                            className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            이미지 삭제
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>거래처명 *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputClass}
                        placeholder="거래처명 입력"
                        required
                      />
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
                    <div className="col-span-2">
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
                </CardContent>
              </Card>

              {/* 연락처 정보 */}
              <Card className="col-span-2 border-none bg-transparent shadow-none">
                <CardHeader className="p-0 pb-2 mb-4 border-b border-slate-100">
                  <CardTitle className="text-base">연락처 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>대표 이메일</label>
                      <input
                        type="email"
                        value={formData.representativeEmail}
                        onChange={(e) =>
                          setFormData({ ...formData, representativeEmail: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>대표 연락처</label>
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
                    <div className="col-span-2">
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
                  </div>
                </CardContent>
              </Card>

              {/* 주소 정보 */}
              <Card className="col-span-2 border-none bg-transparent shadow-none">
                <CardHeader className="p-0 pb-2 mb-4 border-b border-slate-100">
                  <CardTitle className="text-base">주소 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={formData.zipCode}
                      onChange={(e) =>
                        setFormData({ ...formData, zipCode: e.target.value })
                      }
                      className={`${inputClass} w-24`}
                      placeholder="우편번호"
                      readOnly
                    />
                    <button
                      type="button"
                      onClick={openPostcodeSearch}
                      className="h-10 shrink-0 rounded-md border border-blue-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
                    >
                      우편번호 찾기
                    </button>
                  </div>
                  <div>
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
                  <div>
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
                </CardContent>
              </Card>

              {/* 계약 정보 */}
              <Card className="col-span-2 border-none bg-transparent shadow-none">
                <CardHeader className="p-0 pb-2 mb-4 border-b border-slate-100">
                  <CardTitle className="text-base">계약 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>CallLink 연동 ID</label>
                      <input
                        type="text"
                        value={formData.calllinkId}
                        onChange={(e) =>
                          setFormData({ ...formData, calllinkId: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>수수료율 (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={formData.commissionRate}
                        onChange={(e) =>
                          setFormData({ ...formData, commissionRate: e.target.value })
                        }
                        className={inputClass}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>거래 상태</label>
                      <select
                        value={formData.verificationStatus}
                        onChange={(e) =>
                          setFormData({ ...formData, verificationStatus: e.target.value })
                        }
                        className={selectClass}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            form="client-reg-form"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : initialData ? "수정 저장" : "거래처 등록"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
