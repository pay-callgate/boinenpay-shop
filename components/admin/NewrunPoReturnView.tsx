import type { PoReturnApplyResult } from "@/lib/newrun/apply-po-return";
import { wooribugoCustomerServiceLine } from "@/lib/newrun/rwr-result-user-message";

type Props = {
  apply: PoReturnApplyResult | null;
  paramLines: string[];
};

function isSuccessResult(rwr: string): boolean {
  const r = rwr.trim();
  return r === "0" || r === "20";
}

/**
 * `/admin/newrun/po-return` — 뉴런 브라우저 리턴 전용(쇼핑몰 레이아웃 없음).
 */
export function NewrunPoReturnView({ apply, paramLines }: Props) {
  const cs = wooribugoCustomerServiceLine();
  const isParamDetail =
    apply?.kind === "skipped" &&
    (apply.reason === "no_rwr_result" || apply.reason === "no_order_key");

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          파트너 · 뉴런 발주 리턴
        </p>

        {apply?.kind === "applied" ? (
          <>
            <h1
              className={`mt-3 text-lg font-semibold ${
                isSuccessResult(apply.rwr_result) ? "text-emerald-800" : "text-amber-900"
              }`}
            >
              {apply.headline}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{apply.detail}</p>
            <p className="mt-6 text-sm text-slate-500">
              주문번호{" "}
              <span className="font-mono text-slate-900">{apply.orderNo}</span>
            </p>
            {!isSuccessResult(apply.rwr_result) && (
              <p className="mt-6 rounded-lg border border-amber-100 bg-amber-50/90 p-4 text-sm text-amber-950">
                {cs}
              </p>
            )}
          </>
        ) : apply?.kind === "skipped" &&
          (apply.reason === "no_rwr_result" || apply.reason === "no_order_key") ? (
          <>
            <h1 className="mt-3 text-lg font-semibold text-slate-800">
              발주 결과 대기
            </h1>
            <p className="mt-4 text-sm text-slate-600">{apply.message}</p>
            <p className="mt-3 text-xs text-slate-500">
              뉴런이 이 페이지로 리다이렉트하면 URL에 결과 코드가 붙습니다. 창을 닫지 말고
              잠시만 기다려 주세요.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-lg font-semibold text-red-900">처리할 수 없습니다</h1>
            <p className="mt-4 text-sm text-slate-700">
              {apply?.kind === "skipped" ? apply.message : "일시적인 오류가 발생했습니다."}
            </p>
            <p className="mt-6 rounded-lg border border-red-100 bg-red-50/90 p-4 text-sm text-red-950">
              {cs}
            </p>
          </>
        )}

        {paramLines.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-xs text-slate-500">
              전달된 파라미터 (개발·문의용)
            </summary>
            <pre
              className={`mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg border p-3 text-xs ${
                isParamDetail ? "border-slate-200 bg-slate-50" : "border-amber-100 bg-amber-50/80"
              }`}
            >
              {paramLines.join("\n")}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
