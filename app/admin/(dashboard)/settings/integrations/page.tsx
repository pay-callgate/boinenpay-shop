"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS,
  INTRANET_POST_TEST_CREDENTIAL_KEYS,
  type IntranetPostTestCredentialKey,
} from "@/lib/newrun/intranet-post-integration-test-constants";

type CredsFormState = Record<IntranetPostTestCredentialKey, string>;

const CRED_LABELS: Record<IntranetPostTestCredentialKey, string> = {
  rw_rosewebid: "rw_rosewebid",
  rw_rosewebpw: "rw_rosewebpw (변경된 비밀번호 입력)",
  rw_assoc: "rw_assoc",
  rw_associd: "rw_associd",
  rw_sujuid: "rw_sujuid",
};

function initialCredsForm(): CredsFormState {
  return { ...INTEGRATION_INTRANET_POST_FIXED_PAYLOAD_IDS };
}

/**
 * 뉴런 협회 HTTP 도메인 검색 — 브라우저는 open-search(HTTPS)만 연 뒤 서버가 302로 이동.
 * var_ret 콜백은 NEXT_PUBLIC_APP_URL(또는 요청 Host) 기준 절대 URL로 조립됩니다.
 */
export default function AdminNewrunIntegrationsTestPage() {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [previewRaw, setPreviewRaw] = useState<Record<string, unknown> | null>(null);
  const [credsForm, setCredsForm] = useState<CredsFormState>(initialCredsForm);
  const [postResult, setPostResult] = useState<Record<string, unknown> | null>(null);
  const [busyPreview, setBusyPreview] = useState(false);
  const [busyPost, setBusyPost] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const previewDisplay = useMemo(() => {
    if (!previewRaw) return null;
    const f = previewRaw.fields;
    if (!f || typeof f !== "object" || Array.isArray(f)) return previewRaw;
    const fields = { ...(f as Record<string, string>) };
    for (const k of INTRANET_POST_TEST_CREDENTIAL_KEYS) {
      fields[k] = credsForm[k];
    }
    return { ...previewRaw, fields };
  }, [previewRaw, credsForm]);

  const previewJsonText = previewDisplay ? JSON.stringify(previewDisplay, null, 2) : null;

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

  const loadIntranetPostPreview = async () => {
    setPanelError(null);
    setBusyPreview(true);
    try {
      const r = await fetch("/api/partner/integrations/newrun/intranet-post-test", {
        credentials: "same-origin",
      });
      const j = (await r.json()) as Record<string, unknown> & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setPreviewRaw(j);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "미리보기 실패");
      setPreviewRaw(null);
    } finally {
      setBusyPreview(false);
    }
  };

  const sendIntranetPostTest = async () => {
    if (
      !window.confirm(
        "뉴런 ext2intra(intranet_post)로 샘플 Payload가 실제 전송됩니다. 뉴런에 테스트 접수가 생길 수 있습니다. 계속할까요?"
      )
    ) {
      return;
    }
    setPanelError(null);
    setBusyPost(true);
    setPostResult(null);
    try {
      const r = await fetch("/api/partner/integrations/newrun/intranet-post-test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execute: true, credentials: credsForm }),
      });
      const j = (await r.json()) as Record<string, unknown>;
      if (!r.ok) {
        throw new Error(typeof j.error === "string" ? j.error : `HTTP ${r.status}`);
      }
      setPostResult(j);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : "전송 실패");
    } finally {
      setBusyPost(false);
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

      <div className="mt-6 rounded-lg border border-violet-200 bg-violet-50/80 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-violet-950">intranet_post 발주 연동 테스트</h3>
        <p className="mt-2 text-sm text-violet-900/90">
          결제·실주문 없이 서버가 샘플 <code className="text-xs">rw_*</code> 폼을 만들어 뉴런{" "}
          <code className="text-xs">intranet_post.html</code>로 보냅니다. URL은{" "}
          <code className="text-xs">NEWRUN_INTRANET_POST_URL</code>
          (미설정 시 http 기본 도메인)입니다. 아래 입력란에서 로즈웹·협회·수주 ID·비밀번호를 바꾼 뒤 미리보기와 발주 테스트에
          동일하게 반영됩니다. 상품코드 샘플은 <code className="text-xs">var_mcode</code>{" "}
          <code className="text-xs">09</code>입니다.
        </p>
        <div className="mt-4 rounded-md border border-violet-200/80 bg-white/90 p-4">
          <p className="text-xs font-semibold text-violet-950">intranet_post 인증·협회·수주 (테스트용)</p>
          <p className="mt-1 text-xs text-violet-800/85">
            기본값은 코드와 동일합니다. 비밀번호가 바뀌면 여기서 수정 후 다시 전송하세요. 미리보기 JSON의{" "}
            <code className="text-[10px]">fields</code>에 입력값이 그대로 보입니다(파트너 관리자 전용 화면).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {INTRANET_POST_TEST_CREDENTIAL_KEYS.map((key) => (
              <label key={key} className="block text-xs">
                <span className="font-medium text-violet-950">{CRED_LABELS[key]}</span>
                <input
                  type={key === "rw_rosewebpw" ? "password" : "text"}
                  autoComplete="off"
                  value={credsForm[key]}
                  onChange={(e) =>
                    setCredsForm((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-violet-200 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 text-xs font-medium text-violet-800 underline decoration-violet-400 hover:text-violet-950"
            onClick={() => setCredsForm(initialCredsForm())}
          >
            위 값을 코드 기본값으로 되돌리기
          </button>
        </div>
        {panelError ? (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{panelError}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyPreview}
            onClick={() => void loadIntranetPostPreview()}
            className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-50"
          >
            {busyPreview ? "미리보기 로드 중…" : "Payload 미리보기 (GET)"}
          </button>
          <button
            type="button"
            disabled={busyPost}
            onClick={() => void sendIntranetPostTest()}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {busyPost ? "전송 중…" : "발주 테스트 전송 (POST)"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Phase 4 스타일 — 미리보기 JSON</p>
            {previewJsonText ? (
              <pre className="mt-2 max-h-72 overflow-auto rounded border border-violet-200 bg-white p-3 text-xs text-slate-800">
                {previewJsonText}
              </pre>
            ) : (
              <p className="mt-2 text-sm text-violet-800/70">
                위 버튼으로 로드하면 <code>fields</code>·<code>envHints</code>·<code>blockingIssues</code>가 표시됩니다.
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">intranet_post 응답 요약</p>
            {postResult ? (
              <div className="mt-2 space-y-2">
                {postResult.newrunResponse != null &&
                typeof postResult.newrunResponse === "object" &&
                !Array.isArray(postResult.newrunResponse) ? (
                  <div>
                    <p className="text-xs text-violet-900/90">
                      뉴런 반환 스냅샷 — 가이드 <span className="font-medium">2.1.4 반환변수</span>를{" "}
                      <code className="rounded bg-white px-1 text-[10px]">마지막 var_ret</code>과 동일한{" "}
                      <code className="rounded bg-white px-1 text-[10px]">kind</code> +{" "}
                      <code className="rounded bg-white px-1 text-[10px]">payload</code> 형태로 표시합니다.
                    </p>
                    <pre className="mt-1 max-h-56 overflow-auto rounded border border-violet-200 bg-white p-3 text-xs text-slate-800">
                      {JSON.stringify(postResult.newrunResponse, null, 2)}
                    </pre>
                  </div>
                ) : null}
                <details className="rounded border border-violet-100 bg-white/70 p-2">
                  <summary className="cursor-pointer text-xs font-medium text-violet-900">
                    전체 응답 JSON (HTTP·본문 스냅샷·전송 필드 등)
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded border border-violet-200 bg-white p-3 text-xs text-slate-800">
                    {JSON.stringify(postResult, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="mt-2 text-sm text-violet-800/70">
                테스트 전송 후 위에 뉴런 반환(<code>kind: intranet_post_return</code>)이 표시되고, 전체 JSON은 펼쳐서 확인할 수 있습니다.
              </p>
            )}
          </div>
        </div>
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
