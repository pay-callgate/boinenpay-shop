"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FolderPlus,
  List,
  Pencil,
  ScrollText,
  Smartphone,
} from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { InfoTemplatePdpPreview } from "@/components/admin/InfoTemplatePdpPreview";

/**
 * 공통 안내 관리: PDP 하단 안내(info_templates) CRUD — 배송/환불/상품고시 3분할
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

/** 상단 페이지 헤더·카테고리 패널과 톤을 맞춘 카드 헤더 */
const infoPanelHeaderClass =
  "border-b border-slate-200/80 bg-gradient-to-br from-sky-50/40 via-white to-emerald-50/40 px-5 py-3.5 sm:px-6 [@media(min-width:768px)_and_(max-height:860px)]:px-4 [@media(min-width:768px)_and_(max-height:860px)]:py-2.5";

function formatTemplateUpdatedAt(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

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
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-slate-50 p-12 text-sm text-slate-500 [@media(min-width:768px)_and_(max-height:860px)]:p-6">
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50">
      <AdminPageHeader
        eyebrow="Catalog · Info"
        title="공통 안내 관리"
        titleIcon={ScrollText}
        description={
          <span className="break-keep [word-break:keep-all]">
            쇼핑몰 상세페이지 하단에 노출되는 공통 안내 템플릿을 검색과 필터로 빠르게 찾고, 배송·환불·상품 고시 등의 정보를 수정 관리합니다.
          </span>
        }
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:gap-4 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-4 [@media(min-width:768px)_and_(max-height:860px)]:gap-3">
          <div className="flex min-h-[300px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm lg:w-[18.5rem] lg:max-w-[18.5rem] lg:shrink-0">
            <div className={infoPanelHeaderClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
                    Templates · List
                  </p>
                  <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                    <List
                      className="h-5 w-5 shrink-0 text-emerald-600"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    템플릿 목록
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    항목을 선택하면 오른쪽에서 내용을 수정할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="shrink-0 rounded-lg border border-emerald-200/80 bg-white/80 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50/80 sm:text-xs"
                >
                  새로 만들기
                </button>
              </div>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto pb-4 md:hidden">
              <div className="space-y-2 p-3">
                {templates.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                    <p className="text-xs font-medium text-slate-600">등록된 템플릿이 없습니다.</p>
                  </div>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelect(t)}
                      title={t.name}
                      className={`block w-full rounded-xl border px-3 py-3 text-left shadow-sm transition-colors ${
                        selectedId === t.id
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block truncate text-sm font-semibold">{t.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        수정일 {formatTemplateUpdatedAt(t.updated_at)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="scrollbar-thin hidden min-h-0 flex-1 overflow-y-auto pb-4 md:flex md:flex-col">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#e5e7eb]">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">
                      템플릿명
                    </th>
                    <th className="hidden px-3 py-2.5 text-left text-xs font-semibold text-slate-600 xl:table-cell">
                      수정일
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-8 text-center text-xs text-slate-500">
                        등록된 템플릿이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    templates.map((t) => (
                      <tr
                        key={t.id}
                        className={`border-b border-slate-100 transition-colors ${
                          selectedId === t.id ? "bg-blue-50/70" : "hover:bg-slate-50/70"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => handleSelect(t)}
                            title={t.name}
                            className={`block w-full truncate text-left text-xs font-medium sm:text-sm ${
                              selectedId === t.id ? "text-blue-700" : "text-slate-700"
                            }`}
                          >
                            {t.name}
                          </button>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-slate-500 xl:table-cell">
                          {formatTemplateUpdatedAt(t.updated_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className={infoPanelHeaderClass}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
              {selectedId ? "Templates · Edit" : "Templates · New"}
            </p>
            <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {selectedId ? (
                <Pencil
                  className="h-5 w-5 shrink-0 text-emerald-600"
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : (
                <FolderPlus
                  className="h-5 w-5 shrink-0 text-emerald-600"
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
              {selectedId ? "템플릿 수정" : "템플릿 추가"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {selectedId
                ? "저장하면 이 템플릿을 사용하는 카테고리·상품 안내에 반영됩니다."
                : "배송·환불·상품 고시 문구를 입력한 뒤 저장하면 목록에 추가됩니다."}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3 p-4 sm:p-5 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
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
          <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            <div className={infoPanelHeaderClass}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90 sm:text-xs">
                Catalog · Preview
              </p>
              <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                <Smartphone
                  className="h-5 w-5 shrink-0 text-emerald-600"
                  strokeWidth={1.75}
                  aria-hidden
                />
                쇼핑몰 미리보기
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                고객 상품 상세의 「상품 고시 · 배송 안내 · 환불·취소」 탭과 같은 형태로 표시됩니다.
              </p>
            </div>
            <div className="border-t border-slate-100 bg-white p-2 sm:p-3">
              <InfoTemplatePdpPreview
                phonePreview
                productNotice={productNotice}
                deliveryInfo={deliveryInfo}
                refundPolicy={refundPolicy}
              />
            </div>
          </div>
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
