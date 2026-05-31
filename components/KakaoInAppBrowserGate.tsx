"use client";

import React from "react";

/**
 * 카카오톡 인앱 브라우저 — 전역 강제 이탈 비활성화
 *
 * ViewPay 결제는 `assignLocationHrefForPayment` (`lib/kakao-in-app-browser`)로
 * 카카오 IAB 안에서 동일 세션으로 PG URL에 이동합니다.
 */
const KAKAO_IAB_ESCAPE_ENABLED = false;

export function KakaoInAppBrowserGate() {
  if (!KAKAO_IAB_ESCAPE_ENABLED) {
    return null;
  }

  return null;
}
