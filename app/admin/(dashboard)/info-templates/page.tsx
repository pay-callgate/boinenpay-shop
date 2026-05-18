"use client";

import React, { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { InfoTemplatePdpPreview } from "@/components/admin/InfoTemplatePdpPreview";

/**
 * PDP 탭2용 안내 템플릿(info_templates) CRUD — 배송/환불/상품고시 3분할
 */

interface InfoTemplateRow {
  id: string;
  name: string;
  delivery_info: string;
  refund_policy: string;
  product_notice: string;
  updated_at?: string;
}

const inputClass =
  "w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

export default function InfoTemplatesPage() {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<InfoTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("");
  const [productNotice, setProductNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchPartner() {
      const res = await adminFetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) setPartnerId(result.data.id);
        else setPartnerId(null);
      }
    }
    fetchPartner();
  }, []);

  const fetchTemplates = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/info-templates?partnerId=${partnerId}`);
      if (!res.ok) {
        setError("템플릿 목록을 불러오지 못했습니다.");
        return;
      }
      const data = await res.json();
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const resetForm = () => {
    setSelectedId(null);
    setFormName("");
    setDeliveryInfo("");
    setRefundPolicy("");
    setProductNotice("");
  };

  const handleSelect = (t: InfoTemplateRow) => {
    setSelectedId(t.id);
    setFormName(t.name);
    setDeliveryInfo(t.delivery_info ?? "");
    setRefundPolicy(t.refund_policy ?? "");
    setProductNotice(t.product_notice ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId || !formName.trim()) return;
    setSaving(true);
    try {
      if (selectedId) {
        const res = await adminFetch(`/api/info-templates/${selectedId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            deliveryInfo,
            refundPolicy,
            productNotice,
          }),
        });
        if (!res.ok) {
          const j = await res.json();
          alert(j.error || "저장 실패");
          return;
        }
      } else {
        const res = await adminFetch("/api/info-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId,
            name: formName.trim(),
            deliveryInfo,
            refundPolicy,
            productNotice,
          }),
        });
        if (!res.ok) {
          const j = await res.json();
          alert(j.error || "생성 실패");
          return;
        }
      }
      resetForm();
      await fetchTemplates();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !confirm("이 템플릿을 삭제할까요? 카테고리·상품에서 참조 중이면 동작을 확인하세요."))
      return;
    const res = await adminFetch(`/api/info-templates/${selectedId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json();
      alert(j.error || "삭제 실패");
      return;
    }
    resetForm();
    await fetchTemplates();
  };

  if (loading && templates.length === 0 && !error) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500">불러오는 중…</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">안내 템플릿</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          배송 안내·취소/환불·상품 고시를 템플릿으로 저장하고, 카테고리 기본값 또는 상품별로 연결합니다.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4">
          <div className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm lg:w-[15.75rem] lg:max-w-[15.75rem] lg:shrink-0">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
            <h2 className="truncate text-xs font-semibold text-slate-700">템플릿 목록</h2>
            <button
              type="button"
              onClick={() => resetForm()}
              className="shrink-0 text-[10px] font-medium text-blue-600 hover:underline sm:text-xs"
            >
              새로 만들기
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 min-h-[10rem] lg:min-h-0">
            {templates.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">등록된 템플릿이 없습니다.</p>
            ) : (
              <ul className="space-y-0.5">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(t)}
                      title={t.name}
                      className={`w-full truncate rounded-md px-2 py-2 text-left text-xs transition-colors sm:text-sm ${
                        selectedId === t.id
                          ? "bg-slate-100 font-medium text-blue-600"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-700">
              {selectedId ? "템플릿 수정" : "템플릿 추가"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 p-4">
            <div>
              <label className={labelClass}>템플릿 이름 *</label>
              <input
                className={inputClass}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="예: 기본 배송·환불 안내"
              />
            </div>
            <div>
              <label className={labelClass}>상품 고시·유의사항</label>
              <textarea
                className={`${inputClass} min-h-[152px]`}
                value={productNotice}
                onChange={(e) => setProductNotice(e.target.value)}
                rows={7}
              />
            </div>
            <div>
              <label className={labelClass}>배송 안내</label>
              <textarea
                className={`${inputClass} min-h-[152px]`}
                value={deliveryInfo}
                onChange={(e) => setDeliveryInfo(e.target.value)}
                rows={7}
              />
            </div>
            <div>
              <label className={labelClass}>취소·환불 안내</label>
              <textarea
                className={`${inputClass} min-h-[152px]`}
                value={refundPolicy}
                onChange={(e) => setRefundPolicy(e.target.value)}
                rows={7}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={saving || !partnerId}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
              >
                {saving ? "저장 중…" : "저장"}
              </button>
              {selectedId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  삭제
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </form>
        </div>
        </div>

        <aside className="min-h-0 w-full shrink-0 lg:sticky lg:top-4 lg:min-w-[17.5rem] lg:w-[min(23rem,100%)]">
          <div className="mb-2 px-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              쇼핑몰 미리보기
            </h2>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              고객 상품 상세의 「상품 고시 · 배송 안내 · 환불·취소」 탭과 같은 형태로 표시됩니다.
            </p>
          </div>
          <InfoTemplatePdpPreview
            productNotice={productNotice}
            deliveryInfo={deliveryInfo}
            refundPolicy={refundPolicy}
          />
          <div
            className="mt-3 rounded-lg border border-blue-200 bg-blue-50 py-3 pl-2 pr-2.5 text-blue-900 shadow-sm"
            role="note"
            aria-label="입력 형식 안내"
          >
            <div className="flex gap-1.5">
              <span
                className="mt-0.5 shrink-0 text-blue-600"
                aria-hidden
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
                </svg>
              </span>
              <div className="min-w-0 space-y-2 text-[12px] leading-snug text-blue-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                  입력 형식 안내
                </p>
                <ul className="list-inside list-disc space-y-2 pl-0 marker:text-blue-500">
                  <li>
                    <span className="font-medium text-blue-900">최상위 항목:</span> 줄 맨 앞에서{" "}
                    <code className="rounded bg-white/70 px-1 py-0.5 text-[11px] text-blue-900 ring-1 ring-blue-100">- </code>
                    로 시작합니다.{" "}
                    <span className="text-blue-800/90">(앞에 공백 없음)</span>
                  </li>
                  <li>
                    <span className="font-medium text-blue-900">한 단계 들여쓴 하위:</span>{" "}
                    <code className="rounded bg-white/70 px-1 py-0.5 text-[11px] text-blue-900 ring-1 ring-blue-100">
                      {"  - "}
                    </code>
                    <span className="text-blue-800/90">
                      {" "}
                      (스페이스 2개 + 하이픈 + 공백). 한 단계만 들일 때 이 형태만 쓰면 됩니다.
                    </span>
                  </li>
                  <li>
                    <span className="font-medium text-blue-900">굵게:</span>{" "}
                    <code className="rounded bg-white/70 px-1 py-0.5 text-[11px] text-blue-900 ring-1 ring-blue-100">
                      **내용**
                    </code>
                  </li>
                  <li>
                    <span className="font-medium text-blue-900">큰 덩어리 사이 빈 줄:</span> 쇼핑몰에서는
                    문단 간격(
                    <code className="rounded bg-white/70 px-1 py-0.5 text-[11px] text-blue-900 ring-1 ring-blue-100">
                      policy-para-gap
                    </code>
                    )으로 표시됩니다.
                  </li>
                  <li>
                    <span className="font-medium text-blue-900">※ 안내 문구:</span> 목록 안에 넣을 때는{" "}
                    <code className="rounded bg-white/70 px-1 py-0.5 text-[11px] text-blue-900 ring-1 ring-blue-100">
                      {"  - ※ …"}
                    </code>
                    처럼 하위 항목으로 쓰면 들여쓰기가 유지됩니다. 반면{" "}
                    <strong className="font-semibold text-blue-950">별도 줄 맨 앞이 ※</strong>로만
                    시작하면 강조 박스로 처리되며, 그때는 목록 안이 아니라 블록으로 분리됩니다.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
