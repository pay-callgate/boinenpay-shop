"use client";

import React, { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">템플릿 목록</h2>
            <button
              type="button"
              onClick={() => resetForm()}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              새로 만들기
            </button>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {templates.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">등록된 템플릿이 없습니다.</p>
            ) : (
              <ul className="space-y-0.5">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(t)}
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        selectedId === t.id
                          ? "bg-slate-100 text-blue-600 font-medium"
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

        <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-700">
              {selectedId ? "템플릿 수정" : "템플릿 추가"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
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
              <label className={labelClass}>배송 안내</label>
              <textarea
                className={`${inputClass} min-h-[100px]`}
                value={deliveryInfo}
                onChange={(e) => setDeliveryInfo(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <label className={labelClass}>취소·환불 안내</label>
              <textarea
                className={`${inputClass} min-h-[100px]`}
                value={refundPolicy}
                onChange={(e) => setRefundPolicy(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <label className={labelClass}>상품 고시·유의사항</label>
              <textarea
                className={`${inputClass} min-h-[100px]`}
                value={productNotice}
                onChange={(e) => setProductNotice(e.target.value)}
                rows={4}
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
    </div>
  );
}
