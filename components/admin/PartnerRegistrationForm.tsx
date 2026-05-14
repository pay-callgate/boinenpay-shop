"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { adminFetch } from "@/lib/admin-fetch";
import { ADMIN_MODAL_PRIMARY_FORM_SUBMIT_CLASS } from "@/lib/admin-dialog-policy";

interface PartnerRegistrationFormProps {
  subdomain: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface PartnerListItem {
  id: string;
  name: string;
}

interface VerifiedPartner {
  id: string;
  companyName: string | null;
  representative: string | null;
  address: string | null;
  postcode: string | null;
  email: string | null;
  contact: string | null;
  businessType: string | null;
  businessCategory: string | null;
}

const inputClass =
  "block w-full h-11 rounded-md border border-slate-300 px-3 py-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600";
const readonlyClass =
  "block w-full h-11 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 cursor-not-allowed";
/** 운영자·기업 등록 제출 (어드민 모달 Primary 정책과 동일) */
const buttonClass = ADMIN_MODAL_PRIMARY_FORM_SUBMIT_CLASS;

export function PartnerRegistrationForm({
  subdomain,
  onSuccess,
  onCancel,
}: PartnerRegistrationFormProps) {
  const { data: session, status: sessionStatus, update } = useSession();
  const [partnerList, setPartnerList] = useState<PartnerListItem[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedPartner, setVerifiedPartner] = useState<VerifiedPartner | null>(null);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 파트너 목록 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch("/api/partners/list");
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setPartnerList(json.data);
        }
      } catch {
        if (!cancelled) setPartnerList([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 세션에서 성명 초기값 (한 번만)
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.user?.name) return;
    setName((prev) => prev || (session.user?.name ?? ""));
  }, [sessionStatus, session?.user?.name]);

  const handleVerify = async () => {
    setVerifyError("");
    if (!selectedPartnerId || !businessRegistrationNumber.trim()) {
      setVerifyError("소속 파트너사를 선택하고 사업자등록번호를 입력해 주세요.");
      return;
    }
    const brn = businessRegistrationNumber.replace(/-/g, "");
    if (!/^\d{10}$/.test(brn)) {
      setVerifyError("사업자등록번호 10자리 숫자를 입력해 주세요.");
      return;
    }
    setVerifying(true);
    try {
      const res = await adminFetch("/api/partner/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: selectedPartnerId,
          businessRegistrationNumber: brn,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setVerifiedPartner(json.data);
        setVerifyError("");
        alert("사업자 등록 번호가 정상 확인되었습니다.");
      } else {
        setVerifiedPartner(null);
        const errMsg =
          json.error?.message ?? "선택한 파트너(기업)에 등록된 사업자등록번호와 일치하지 않습니다.";
        setVerifyError(errMsg);
        alert(errMsg);
      }
    } catch {
      setVerifiedPartner(null);
      setVerifyError("검증 요청 중 오류가 발생했습니다.");
      alert("검증 요청 중 오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!verifiedPartner?.id) {
      setSubmitError("먼저 소속 파트너사를 선택하고 사업자등록번호로 조회해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminFetch("/api/partner/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: verifiedPartner.id,
          name: name.trim(),
          contact: contact.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        await update({ role: "partner_admin", profileCompleted: true });
        onSuccess?.();
      } else {
        setSubmitError(json.error?.message ?? "등록에 실패했습니다.");
      }
    } catch {
      setSubmitError("서버 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const userEmail = session?.user?.email ?? "";

  return (
    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-8">
      {(verifyError || submitError) && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {verifyError || submitError}
        </div>
      )}

      {/* [1] 소속 파트너사 조회 및 검증 */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">소속 파트너사 조회 및 검증</h3>
        <div className="space-y-4">
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">소속 파트너사 선택</label>
            <select
              value={selectedPartnerId}
              onChange={(e) => {
                setSelectedPartnerId(e.target.value);
                setVerifiedPartner(null);
                setVerifyError("");
              }}
              className={inputClass}
              disabled={partnerList.length === 0}
            >
              <option value="">선택하세요</option>
              {partnerList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">사업자등록번호</label>
              <input
                type="text"
                value={businessRegistrationNumber}
                onChange={(e) => {
                  setBusinessRegistrationNumber(e.target.value);
                  setVerifyError("");
                }}
                placeholder="000-00-00000"
                className={inputClass}
                maxLength={12}
              />
            </div>
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || !selectedPartnerId}
              className={`shrink-0 ${buttonClass}`}
            >
              {"조회"}
            </button>
          </div>
        </div>
      </div>

      {/* [2] 파트너사 정보 자동 완성 (검증 성공 시 트랜지션 노출, readonly) */}
      {verifiedPartner && (
        <div className="overflow-hidden transition-all duration-300 ease-out">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">파트너사 정보 (확인용)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">사업장 주소</label>
              <input
                type="text"
                readOnly
                value={[verifiedPartner.postcode, verifiedPartner.address].filter(Boolean).join(" ") || "-"}
                className={readonlyClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">대표자명</label>
              <input type="text" readOnly value={verifiedPartner.representative ?? "-"} className={readonlyClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">대표자 이메일</label>
              <input type="text" readOnly value={verifiedPartner.email ?? "-"} className={readonlyClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">연락처</label>
              <input type="text" readOnly value={verifiedPartner.contact ?? "-"} className={readonlyClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">업태</label>
              <input type="text" readOnly value={verifiedPartner.businessType ?? "-"} className={readonlyClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">업종</label>
              <input type="text" readOnly value={verifiedPartner.businessCategory ?? "-"} className={readonlyClass} />
            </div>
          </div>
        </div>
      )}

      {/* [3] 내 정보 (부운영자) 등록 */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3">내 정보 (부운영자) 등록</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">성명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className={inputClass}
            />
          </div>
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">연락처</label>
            <input
              type="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="010-0000-0000"
              className={inputClass}
            />
          </div>
          <div className="col-span-2 w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">이메일</label>
            <input
              type="email"
              readOnly
              value={userEmail}
              className={readonlyClass}
              title="로그인 계정 이메일 (변경 불가)"
            />
            <p className="mt-1 text-xs text-slate-500">로그인한 SNS 계정 이메일입니다.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={`min-w-[100px] ${buttonClass}`}
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !verifiedPartner}
          className={`min-w-[140px] ${buttonClass}`}
        >
          {"운영자 등록"}
        </button>
      </div>
    </form>
  );
}
