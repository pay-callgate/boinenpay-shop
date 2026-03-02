"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

interface PartnerRegistrationFormProps {
  subdomain: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PartnerRegistrationForm({
  subdomain,
  onSuccess,
  onCancel,
}: PartnerRegistrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    franchiseName: "", // 가맹점명 (새로 추가)
    businessRegistrationNumber: "",
    corporateRegistrationNumber: "", // 법인등록번호 (새로 추가)
    companyName: "",
    representative: "",
    representativeDob: "", // 대표자 생년월일 (새로 추가)
    address: "",
    postcode: "",
    businessType: "",
    contact: "",
    representativeContact: "", // 대표자 연락처 (새로 추가)
    fax: "",
    businessCategory: "",
    email: "",
    representativeEmail: "", // 대표자 이메일 (새로 추가)
    tradeCategories: "" as string,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await adminFetch("/api/partner/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          businessRegistrationNumber: form.businessRegistrationNumber.replace(
            /-/g,
            ""
          ),
          tradeCategories: form.tradeCategories
            ? form.tradeCategories
                .split(/[,，]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          subdomain:
            subdomain ||
            form.companyName?.replace(/\s/g, "").toLowerCase().slice(0, 20) ||
            "partner",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "등록에 실패했습니다.");
        return;
      }
      // 성공 시 콜백 호출
      onSuccess?.();
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="px-6 py-6">
      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* 2열 그리드 레이아웃 (반응형) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
        {/* Row 1: 가맹점명 | 사업자명 */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            가맹점명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="franchiseName"
            value={form.franchiseName}
            onChange={handleChange}
            required
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            사업자명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            required
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        {/* Row 2: 사업자등록번호 | 법인등록번호 */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            사업자등록번호 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="businessRegistrationNumber"
            value={form.businessRegistrationNumber}
            onChange={handleChange}
            placeholder="000-00-00000"
            required
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
            maxLength={12}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            법인등록번호
          </label>
          <input
            type="text"
            name="corporateRegistrationNumber"
            value={form.corporateRegistrationNumber}
            onChange={handleChange}
            placeholder="000000-0000000"
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        {/* Row 3: 사업장주소 (Full Width) */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            사업장주소 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            required
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        {/* Row 4: 대표자명 | 대표자 생년월일 */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            대표자명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="representative"
            value={form.representative}
            onChange={handleChange}
            required
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            대표자 생년월일
          </label>
          <input
            type="date"
            name="representativeDob"
            value={form.representativeDob}
            onChange={handleChange}
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        {/* Row 5: 대표자 이메일 | 대표자 연락처 */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            대표자 이메일 <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            name="representativeEmail"
            value={form.representativeEmail}
            onChange={handleChange}
            required
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            대표자 연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            name="representativeContact"
            value={form.representativeContact}
            onChange={handleChange}
            required
            placeholder="010-0000-0000"
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        {/* Row 6: 업태 | 업종 */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            업태
          </label>
          <input
            type="text"
            name="businessType"
            value={form.businessType}
            onChange={handleChange}
            placeholder="예: 도소매업"
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            업종
          </label>
          <input
            type="text"
            name="businessCategory"
            value={form.businessCategory}
            onChange={handleChange}
            placeholder="예: 외식업"
            className="block w-full h-10 rounded border border-gray-300 px-3 text-sm focus:border-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-700"
          />
        </div>
      </div>

      {/* Footer 버튼 - 동일한 너비 */}
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-w-[100px] h-10 rounded border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="min-w-[100px] h-10 rounded bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "등록 중..." : "등록"}
        </button>
      </div>
    </form>
  );
}
