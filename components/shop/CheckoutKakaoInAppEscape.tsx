"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  buildAndroidChromeIntentUrl,
  isAndroidUserAgent,
  isIOSUserAgent,
  isKakaoTalkInAppBrowser,
} from "@/lib/kakao-in-app-browser";
import { isCheckoutKakaoEscapePath } from "@/lib/shop-payment-tunnel";

/**
 * 주문서(/checkout, /guest-order)에서만 동작 (KAKAO_IAB_ESCAPE_ENABLED와 무관).
 * 카카오 인앱 → ViewPay 팝업 충돌 완화: Android는 Chrome intent, iOS는 Safari 새 창 시도 또는 안내 오버레이.
 */
export function CheckoutKakaoInAppEscape() {
  const pathname = usePathname();
  const [iosPrompt, setIosPrompt] = useState(false);
  const [iosHref, setIosHref] = useState("");

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!isCheckoutKakaoEscapePath(pathname)) return;

    const ua = navigator.userAgent;
    if (!isKakaoTalkInAppBrowser(ua)) return;

    const href = window.location.href;
    if (isAndroidUserAgent(ua)) {
      window.location.replace(buildAndroidChromeIntentUrl(href));
      return;
    }

    if (isIOSUserAgent(ua)) {
      const w = window.open(href, "_blank", "noopener,noreferrer");
      if (w == null) {
        setIosHref(href);
        setIosPrompt(true);
      }
    }
  }, [pathname]);

  if (!iosPrompt || !iosHref) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 px-6 text-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="kakao-escape-title"
    >
      <p id="kakao-escape-title" className="mb-2 text-base font-bold text-white">
        Safari에서 결제를 계속해 주세요
      </p>
      <p className="mb-6 text-sm leading-relaxed text-white/90">
        카카오톡 인앱 브라우저에서는 결제창이 정상 동작하지 않을 수 있습니다. 아래 버튼으로 Safari를
        연 뒤 같은 주문 화면에서 결제를 진행해 주세요.
      </p>
      <a
        href={iosHref}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-gray-900 shadow-lg"
      >
        Safari에서 열기
      </a>
    </div>
  );
}
