"use client";

import React from "react";

/**
 * 카카오톡 인앱 브라우저 — 외부 브라우저 강제 이탈 비활성화
 *
 * 정책: 고객이 알림톡 링크로 입장한 뒤 **카카오 인앱에서 쇼핑·ViewPay 결제까지** 이어가도록 함.
 *
 * 과거 구현(비활성화됨):
 * - Android: Chrome intent(`buildAndroidChromeIntentUrl`)로 즉시 이탈
 * - iOS: Safari·「다른 브라우저로 열기」 전체 화면 안내
 * 배경: WebView에서 Google OAuth 등 `disallowed_useragent` 제한 대응.
 *
 * 복구 시: 아래 `KAKAO_IAB_ESCAPE_ENABLED` 를 true 로 두고,
 * `git` 히스토리에서 이전 본문(훅·오버레이 JSX)을 되살리거나 `lib/kakao-in-app-browser` 를 다시 연결.
 */
const KAKAO_IAB_ESCAPE_ENABLED = false;

export function KakaoInAppBrowserGate() {
  if (!KAKAO_IAB_ESCAPE_ENABLED) {
    return null;
  }

  // 이 분기는 현재 도달하지 않음. 외부 브라우저 이탈을 다시 켤 때만 구현 복원.
  return null;
}

/*
 * === 이전 구현 참고용 (KAKAO_IAB_ESCAPE_ENABLED === true 일 때 복원) ===
 *
 * import { useLayoutEffect, useState } from "react";
 * import {
 *   buildAndroidChromeIntentUrl,
 *   isAndroidUserAgent,
 *   isIOSUserAgent,
 *   isKakaoTalkInAppBrowser,
 * } from "@/lib/kakao-in-app-browser";
 *
 * useLayoutEffect(() => {
 *   if (typeof window === "undefined") return;
 *   const ua = navigator.userAgent;
 *   if (!isKakaoTalkInAppBrowser(ua)) return;
 *   if (isAndroidUserAgent(ua)) {
 *     window.location.replace(buildAndroidChromeIntentUrl(window.location.href));
 *     return;
 *   }
 *   if (isIOSUserAgent(ua)) setIosOverlay(true);
 * }, []);
 */
