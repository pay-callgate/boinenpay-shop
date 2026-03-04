"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut } from "next-auth/react";
import { toast } from "@/components/shop/ToastContext";

/** 유휴 시간(분). 환경변수 NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN (기본 30분). 최소 30분으로 고정 */
const IDLE_TIMEOUT_MIN = 30;
const IDLE_TIMEOUT_MS = Math.max(
  typeof process.env.NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN !== "undefined" &&
    Number(process.env.NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN) > 0
    ? Number(process.env.NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN) * 60 * 1000
    : IDLE_TIMEOUT_MIN * 60 * 1000,
  IDLE_TIMEOUT_MIN * 60 * 1000
);

/** 로그아웃 1분 전 경고 */
const WARNING_BEFORE_MS = 60 * 1000;

const ADMIN_LOGIN_URL = "/admin/login?callbackUrl=/admin";
const IDLE_WARNING_MESSAGE = "장시간 미활동으로 1분 후 로그아웃됩니다.";
const IDLE_LOGOUT_MESSAGE = "세션이 만료되어 로그인 화면으로 이동합니다.";

export function AdminIdleGuard({ children }: { children: React.ReactNode }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    toast(IDLE_LOGOUT_MESSAGE, "default");
    signOut({ redirect: false }).finally(() => {
      if (typeof window !== "undefined") {
        window.location.replace(ADMIN_LOGIN_URL);
      }
    });
  }, []);

  const scheduleWarning = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (IDLE_TIMEOUT_MS <= WARNING_BEFORE_MS) return;
    warningTimerRef.current = setTimeout(() => {
      warningTimerRef.current = null;
      toast(IDLE_WARNING_MESSAGE, "default");
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
  }, []);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      scheduleWarning();
      timerRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
    };

    resetTimer();

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [handleLogout, scheduleWarning]);

  return <>{children}</>;
}
