"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

/**
 * 뉴런 협회 HTTP 도메인 검색 — 브라우저는 open-search(HTTPS)만 연 뒤 서버 302로 이동.
 * var_ret 콜백은 NEXT_PUBLIC_APP_URL(또는 요청 Host) 기준 절대 URL로 조립됩니다.
 */
export default function AdminNewrunIntegrationsTestPage() {
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as { type?: string; kind?: string; payload?: unknown };
      if (!data || data.type !== "NEWRUN_VAR_RET") return;
      setLastMessage(JSON.stringify({ kind: data.kind, payload: data.payload }, null, 2));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const openViaProxy = (kind: "florist" | "product" | "option") => {
    const path = `/api/partner/integrations/newrun/open-search?kind=${encodeURIComponent(kind)}`;
    /** `noopener` 제외 — 콜백 페이지가 `window.opener.postMessage`로 부모에 전달함 */
    const w = window.open(path, "_blank", "width=1100,height=800");
    if (w == null) {
      alert("팝업이 차단되었습니다. 이 사이트에 대한 팝업을 허용한 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <div className="min-h-full w-full max-w-3xl">
      <div className="mb-6">
        <p className="text-sm text-slate-600">
          <Link href="/admin/settings" className="text-blue-600 hover:underline">
            ← 파트너 설정
          </Link>
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-800">뉴런 연동 사전 테스트</h2>
        <p className="mt-1 text-sm text-slate-600">
          발주(POST) 전 협회 검색 URL·<code className="text-xs">var_ret</code> 콜백 경로를 확인합니다.
          운영·스테이징·Ngrok 모두{" "}
          <strong className="font-semibold text-slate-700">HTTPS에서 접속한 동일 호스트</strong>로 테스트해 주세요.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="font-semibold">배포·로컬 공통</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            Vercel·Ngrok: <code className="rounded bg-white px-1">NEXT_PUBLIC_APP_URL</code>을{" "}
            <strong>뉴런이 호출할 수 있는 공개 HTTPS 절대 URL</strong>(예: <code className="text-xs">https://xxx.ngrok.app</code>
            , 프로덕션 도메인)으로 설정합니다.
          </li>
          <li>
            <code className="rounded bg-white px-1">NEWRUN_ASSOC_BASE_URL</code>,{" "}
            <code className="rounded bg-white px-1">NEWRUN_ASSOC_INTRANET_ID</code>가 서버에 있어야 합니다.
          </li>
        </ul>
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">수주화원·상품·옵션 검색 (팝업)</h3>
        <p className="mt-2 text-sm text-slate-600">
          아래 버튼은 동일 출처 API로 연 뒤 서버가 협회 HTTP URL로 리다이렉트합니다(Mixed Content 회피).
          검색 후 협회가 <code className="text-xs">var_ret</code>으로 돌아오면 이 탭 하단에 콜백 페이로드가 표시됩니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openViaProxy("florist")}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            수주화원 검색 테스트
          </button>
          <button
            type="button"
            onClick={() => openViaProxy("product")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            상품 검색 테스트
          </button>
          <button
            type="button"
            onClick={() => openViaProxy("option")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            옵션 검색 테스트
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">마지막 var_ret (postMessage)</h3>
        {lastMessage ? (
          <pre className="mt-3 max-h-80 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
            {lastMessage}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-slate-500">아직 수신한 콜백이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
