"use client";

import { formatAdminNewrunSubmitLabel } from "@/lib/newrun/admin-order-newrun-summary";
import {
  ADMIN_NEWRUN_DELIVERY_STATE_HINT_LONG,
  hasNewrunDeliveryCallbackInfo,
} from "@/lib/newrun/admin-newrun-courier-lock";

type OrderLike = {
  payment_status: string;
  newrun_submit_status?: string | null;
  newrun_rwr_result?: string | null;
  newrun_rwr_orderkey?: string | null;
  newrun_last_submit_error?: string | null;
  newrun_last_submit_at?: string | null;
  newrun_florist_draft?: Record<string, unknown> | null;
  newrun_product_draft?: Record<string, unknown> | null;
  newrun_option_draft?: Record<string, unknown> | null;
  newrun_delivery_info?: Record<string, unknown> | null;
  client?: {
    newrun_default_florist_draft?: Record<string, unknown> | null;
  } | null;
};

type ItemLike = {
  product?: {
    newrun_default_product_draft?: Record<string, unknown> | null;
    newrun_default_option_draft?: Record<string, unknown> | null;
  } | null;
};

export type OrderDetailNewrunPanelProps = {
  order: OrderLike;
  items: ItemLike[];
  newrunDispatchSummary: { sujuid: string; menucode: string };
  effectiveNewrunFlorist: Record<string, unknown> | null;
  effectiveNewrunProduct: Record<string, unknown> | null;
  effectiveNewrunOption: Record<string, unknown> | null;
  newrunFloristPayload: Record<string, string> | null;
  newrunProductPayload: Record<string, string> | null;
  newrunOptionPayload: Record<string, string> | null;
  newrunPreviewJson: string | null;
  newrunPreviewLoading: boolean;
  newrunSubmitLoading: boolean;
  newrunOpening: string | null;
  formatDate: (iso: string) => string;
  loadNewrunPayloadPreview: () => void;
  submitNewrunManual: (forceRetry: boolean) => void;
  openNewrunSearch: (kind: "florist" | "product" | "option") => void;
  resetNewrunFloristOrderDraft: () => void;
};

export function OrderDetailNewrunPanel({
  order,
  items,
  newrunDispatchSummary,
  effectiveNewrunFlorist,
  effectiveNewrunProduct,
  effectiveNewrunOption,
  newrunFloristPayload,
  newrunProductPayload,
  newrunOptionPayload,
  newrunPreviewJson,
  newrunPreviewLoading,
  newrunSubmitLoading,
  newrunOpening,
  formatDate,
  loadNewrunPayloadPreview,
  submitNewrunManual,
  openNewrunSearch,
  resetNewrunFloristOrderDraft,
}: OrderDetailNewrunPanelProps) {
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
      <h2 className="mb-1 text-lg font-bold text-[#111]">뉴런 발주 — 협회 검색</h2>
      <p className="mb-2 text-xs text-gray-600">
        협회 인트라넷에서 선택 후 이 창으로 돌아오면 아래에 표시되며, 주문에 자동 저장됩니다. (팝업 허용 필요)
      </p>
      <p className="mb-4 rounded-md border border-violet-100 bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
        <span className="font-semibold">병합(T3.4):</span> 수주화원은 거래처 기본 → 주문 저장 순으로 합치고, 상품·옵션은{" "}
        <strong>첫 번째 주문 품목</strong>의 상품 기본 → 주문 저장 순입니다. 같은 키는 뒤쪽(주문 저장)이 우선합니다.
      </p>
      <div className="mb-4 space-y-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
        <p className="font-semibold text-gray-800">intranet_post 발주 상태 (Phase 5)</p>
        <p>
          <span className="font-medium">
            {formatAdminNewrunSubmitLabel({
              payment_status: order.payment_status,
              newrun_submit_status: order.newrun_submit_status,
              newrun_rwr_result: order.newrun_rwr_result,
            })}
          </span>
          {order.newrun_submit_status?.trim() ? (
            <span className="text-gray-500"> (DB: {order.newrun_submit_status})</span>
          ) : null}
          {order.newrun_rwr_result != null && order.newrun_rwr_result !== "" && (
            <> · 결과코드: {order.newrun_rwr_result}</>
          )}
        </p>
        <p className="border-t border-gray-100 pt-1 text-[11px] text-gray-600">
          발주 필드 요약: <span className="font-mono">rw_sujuid</span>={newrunDispatchSummary.sujuid} ·{" "}
          <span className="font-mono">rw_menucode</span>={newrunDispatchSummary.menucode}
        </p>
        {order.newrun_rwr_orderkey ? (
          <p className="break-all">협회 주문키: {order.newrun_rwr_orderkey}</p>
        ) : null}
        {order.newrun_last_submit_error ? (
          <p className="break-all text-red-700">마지막 오류: {order.newrun_last_submit_error}</p>
        ) : null}
        {order.newrun_last_submit_at ? (
          <p className="text-gray-500">마지막 시도: {formatDate(order.newrun_last_submit_at)}</p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            disabled={newrunSubmitLoading || order.payment_status !== "paid"}
            onClick={() => void submitNewrunManual(false)}
            className="h-8 rounded-md bg-violet-800 px-3 text-xs font-semibold text-white hover:bg-violet-900 disabled:opacity-50"
          >
            {newrunSubmitLoading ? "처리 중…" : "뉴런 발주 실행 (수동)"}
          </button>
          <button
            type="button"
            disabled={newrunSubmitLoading || order.payment_status !== "paid"}
            onClick={() => void submitNewrunManual(true)}
            className="h-8 rounded-md bg-violet-100 px-3 text-xs font-medium text-violet-900 hover:bg-violet-200 disabled:opacity-50"
          >
            강제 재시도
          </button>
        </div>
        <p className="pt-1 text-[11px] text-gray-500">
          결제 완료 직후 자동 발주가 실패한 경우 여기서 재시도합니다.
        </p>
      </div>
      {hasNewrunDeliveryCallbackInfo(order.newrun_delivery_info) ? (
        <div className="mb-4 space-y-1 rounded-md border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs text-gray-800">
          <p className="font-semibold text-teal-900">협회 배송 통보 (뉴런 2.6 · Phase 7)</p>
          {(() => {
            const di = order.newrun_delivery_info!;
            const st = di.state != null ? String(di.state) : "";
            const stHint = st ? ADMIN_NEWRUN_DELIVERY_STATE_HINT_LONG[st] ?? `코드 ${st}` : "—";
            return (
              <>
                <p>
                  통보 상태: <span className="font-medium">{st || "—"}</span>
                  {st ? <span className="text-gray-600"> ({stHint})</span> : null}
                </p>
                {di.ordercode != null && String(di.ordercode).trim() !== "" ? (
                  <p className="break-all">협회 주문코드: {String(di.ordercode)}</p>
                ) : null}
                {di.dica != null && String(di.dica).trim() !== "" ? (
                  <p>
                    배송 이미지:{" "}
                    <a
                      href={String(di.dica)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-medium text-teal-800 underline"
                    >
                      열기
                    </a>
                  </p>
                ) : null}
                {di.insuname != null && String(di.insuname).trim() !== "" ? (
                  <p>
                    인수자: {String(di.insuname)}
                    {di.insurel != null && String(di.insurel).trim() !== ""
                      ? ` (${String(di.insurel)})`
                      : null}
                    {(di.insudate1 != null && String(di.insudate1) !== "") ||
                    (di.insudate2 != null && String(di.insudate2) !== "")
                      ? ` · ${[di.insudate1, di.insudate2].filter(Boolean).join(":")}`
                      : null}
                  </p>
                ) : null}
                {di.lastCallbackAt != null && String(di.lastCallbackAt).trim() !== "" ? (
                  <p className="text-gray-500">
                    마지막 통보 시각: {formatDate(String(di.lastCallbackAt))}
                  </p>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={newrunPreviewLoading}
          onClick={() => void loadNewrunPayloadPreview()}
          className="h-9 rounded-lg bg-violet-200 px-4 text-sm font-medium text-violet-950 hover:bg-violet-300 disabled:opacity-50"
        >
          {newrunPreviewLoading ? "불러오는 중…" : "intranet_post 필드 미리보기"}
        </button>
        <button
          type="button"
          disabled={!!newrunOpening}
          onClick={() => openNewrunSearch("florist")}
          className="h-9 rounded-lg bg-violet-700 px-4 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
        >
          {newrunOpening === "florist" ? "열는 중…" : "수주화원 검색"}
        </button>
        <button
          type="button"
          disabled={(() => {
            const orderKeys =
              order?.newrun_florist_draft != null &&
              typeof order.newrun_florist_draft === "object" &&
              !Array.isArray(order.newrun_florist_draft)
                ? Object.keys(order.newrun_florist_draft as Record<string, unknown>).length
                : 0;
            const localKeys = newrunFloristPayload ? Object.keys(newrunFloristPayload).length : 0;
            return newrunSubmitLoading || (orderKeys === 0 && localKeys === 0);
          })()}
          onClick={() => void resetNewrunFloristOrderDraft()}
          className="h-9 rounded-lg border border-gray-200 bg-gray-100 px-4 text-sm font-medium text-violet-900 hover:bg-gray-200 disabled:opacity-50"
        >
          수주화원(주문) 저장 초기화
        </button>
        <button
          type="button"
          disabled={!!newrunOpening}
          onClick={() => openNewrunSearch("product")}
          className="h-9 rounded-lg bg-violet-100 px-4 text-sm font-medium text-violet-900 hover:bg-violet-200 disabled:opacity-50"
        >
          {newrunOpening === "product" ? "열는 중…" : "상품 검색"}
        </button>
        <button
          type="button"
          disabled={!!newrunOpening}
          onClick={() => openNewrunSearch("option")}
          className="h-9 rounded-lg bg-violet-100 px-4 text-sm font-medium text-violet-900 hover:bg-violet-200 disabled:opacity-50"
        >
          {newrunOpening === "option" ? "열는 중…" : "옵션 상품 검색"}
        </button>
      </div>
      {newrunPreviewJson ? (
        <div className="mb-4 rounded-md border border-violet-200 bg-violet-50/80 p-3">
          <p className="mb-2 text-xs font-semibold text-violet-900">
            Phase 4 매핑 결과 (비밀번호 마스킹 · 발주 전 검증은 blockingIssues 참고)
          </p>
          <pre className="max-h-64 overflow-x-auto overflow-y-auto whitespace-pre-wrap break-all text-[11px] text-gray-800">
            {newrunPreviewJson}
          </pre>
        </div>
      ) : null}
      <div className="grid gap-3 text-sm">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-600">수주화원 — 발주 시 적용(병합)</p>
          {effectiveNewrunFlorist ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-gray-800">
              {JSON.stringify(effectiveNewrunFlorist, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-gray-500">거래처 기본·주문 저장 모두 없음</p>
          )}
          <p className="mt-1 text-[11px] text-gray-500">
            거래처 기본: {order.client?.newrun_default_florist_draft ? "있음" : "없음"} · 주문 저장:{" "}
            {newrunFloristPayload || order.newrun_florist_draft ? "있음" : "없음"}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-600">상품 — 발주 시 적용(병합, 1번 품목)</p>
          {effectiveNewrunProduct ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-gray-800">
              {JSON.stringify(effectiveNewrunProduct, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-gray-500">상품 기본·주문 저장 모두 없음</p>
          )}
          <p className="mt-1 text-[11px] text-gray-500">
            1번 품목 상품 기본:{" "}
            {items[0]?.product?.newrun_default_product_draft ? "있음" : "없음"} · 주문 저장:{" "}
            {newrunProductPayload || order.newrun_product_draft ? "있음" : "없음"}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold text-gray-600">옵션 — 발주 시 적용(병합, 1번 품목)</p>
          {effectiveNewrunOption ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs text-gray-800">
              {JSON.stringify(effectiveNewrunOption, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-gray-500">상품 기본·주문 저장 모두 없음</p>
          )}
          <p className="mt-1 text-[11px] text-gray-500">
            1번 품목 옵션 기본:{" "}
            {items[0]?.product?.newrun_default_option_draft ? "있음" : "없음"} · 주문 저장:{" "}
            {newrunOptionPayload || order.newrun_option_draft ? "있음" : "없음"}
          </p>
        </div>
      </div>
    </div>
  );
}
