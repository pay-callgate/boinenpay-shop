"use client";

import React, { useLayoutEffect, useState } from "react";
import {
  buildAndroidChromeIntentUrl,
  isAndroidUserAgent,
  isIOSUserAgent,
  isKakaoTalkInAppBrowser,
} from "@/lib/kakao-in-app-browser";

/**
 * 카카오톡 인앱 접속 시:
 * - Android: Chrome intent로 즉시 이탈 시도
 * - iOS: 외부 브라우저(Safari) 유도 전체 화면 오버레이
 */
export function KakaoInAppBrowserGate() {
  const [iosOverlay, setIosOverlay] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent;
    if (!isKakaoTalkInAppBrowser(ua)) return;

    if (isAndroidUserAgent(ua)) {
      const intentUrl = buildAndroidChromeIntentUrl(window.location.href);
      window.location.replace(intentUrl);
      return;
    }

    if (isIOSUserAgent(ua)) {
      setIosOverlay(true);
    }
  }, []);

  useLayoutEffect(() => {
    if (!iosOverlay) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [iosOverlay]);

  if (!iosOverlay) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-slate-900/75 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kakao-iab-title"
      aria-describedby="kakao-iab-desc"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FEE500] text-2xl font-bold text-[#3C1E1E]">
            Kakao
          </div>
        </div>
        <h2
          id="kakao-iab-title"
          className="text-center text-lg font-bold text-slate-900"
        >
          기본 브라우저에서 이용해 주세요
        </h2>
        <p
          id="kakao-iab-desc"
          className="mt-4 text-sm leading-relaxed text-slate-600"
        >
          원활한 <strong className="text-slate-800">구글 로그인</strong> 및{" "}
          <strong className="text-slate-800">주문</strong>을 위해 기본 브라우저(
          <strong className="text-slate-800">Safari</strong>)로 이동합니다.
          <br />
          <br />
          우측 하단의{" "}
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-slate-300 bg-slate-100 px-1 font-mono text-sm text-slate-700"
            aria-hidden
          >
            ⠇
          </span>{" "}
          아이콘을 눌러{" "}
          <strong className="text-slate-800">「다른 브라우저로 열기」</strong>{" "}
          또는 <strong className="text-slate-800">「Safari로 열기」</strong>를
          선택해 주세요.
        </p>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          카카오톡 앱 안에서는 일부 소셜 로그인이 제한될 수 있습니다.
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          이미 Safari에서 보고 있다면 이 안내를 닫아도 됩니다.
        </p>
        <button
          type="button"
          onClick={() => setIosOverlay(false)}
          className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
