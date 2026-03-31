"use client";

import { useEffect, useState } from "react";
import {
  isAndroidUserAgent,
  isIOSUserAgent,
  isKakaoTalkInAppBrowser,
} from "@/lib/kakao-in-app-browser";

export type KakaoInAppBrowserDetectState = {
  /** 클라이언트에서 UA를 읽은 뒤 true */
  ready: boolean;
  isKakaoTalkInApp: boolean;
  isAndroid: boolean;
  isIOS: boolean;
};

/**
 * User-Agent 기준 카카오톡 인앱 여부 및 모바일 OS 구분.
 * 최초 렌더에서는 ready=false (SSR/하이드레이션 불일치 방지).
 */
export function useKakaoInAppBrowserDetect(): KakaoInAppBrowserDetectState {
  const [state, setState] = useState<KakaoInAppBrowserDetectState>({
    ready: false,
    isKakaoTalkInApp: false,
    isAndroid: false,
    isIOS: false,
  });

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setState({
      ready: true,
      isKakaoTalkInApp: isKakaoTalkInAppBrowser(ua),
      isAndroid: isAndroidUserAgent(ua),
      isIOS: isIOSUserAgent(ua),
    });
  }, []);

  return state;
}
