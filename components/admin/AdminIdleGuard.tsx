"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut } from "next-auth/react";

/** 유휴 시간(분). 환경변수 ADMIN_IDLE_TIMEOUT_MIN 또는 기본 30분 */
const IDLE_TIMEOUT_MS =
  (typeof process.env.NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN !== "undefined"
    ? Number(process.env.NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN) * 60 * 1000
    : 30 * 60 * 1000) || 30 * 60 * 1000;

const IDLE_ALERT_MESSAGE =
  "장시간 사용자 활동이 없어 세션이 종료됩니다. 다시 로그인해 주세요.";

export function AdminIdleGuard({ children }: { children: React.ReactNode }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLogout = useCallback(() => {
    alert(IDLE_ALERT_MESSAGE);
    signOut({ redirect: true, callbackUrl: "/admin/login?callbackUrl=/admin" });
  }, []);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [handleLogout]);

  return <>{children}</>;
}
