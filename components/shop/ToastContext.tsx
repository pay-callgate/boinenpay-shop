"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

const PRIMARY = "#D6A8E0";

type ToastType = "success" | "error" | "default" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** 토스트가 ToastProvider 외부에서 호출될 수 있도록 전역 함수 (layout에서 주입) */
let globalToast: ((message: string, type?: ToastType) => void) | null = null;
export function setGlobalToast(fn: ((message: string, type?: ToastType) => void) | null) {
  globalToast = fn;
}

/**
 * 쇼핑몰 전역 토스트: alert 대체용.
 * - success / info: 연보라 톤, error/default: 짙은 회색 배경
 * - 하단 중앙, 2.5초 후 자동 사라짐, Fade in/out
 */
export function toast(message: string, type: ToastType = "default") {
  if (globalToast) globalToast(message, type);
  // ToastProvider 외부 호출 시 아무것도 표시하지 않음 (alert fallback 제거)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "default") => {
    const id = nextIdRef.current++;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }, 2500);
  }, []);

  React.useEffect(() => {
    setGlobalToast(showToast);
    return () => setGlobalToast(null);
  }, [showToast]);

  const value: ToastContextValue = { toast: showToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer items={items} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ items }: { items: ToastItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 z-[9999] flex flex-col items-center gap-2 px-4"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      }}
      aria-live="polite"
    >
      {items.map((item) => (
        <ToastItem key={item.id} {...item} />
      ))}
    </div>
  );
}

function ToastItem({ message, type }: ToastItem) {
  const isPastel = type === "success" || type === "info";
  return (
    <div
      className="animate-toast-in max-w-[calc(100%-2rem)] rounded-xl px-5 py-3 text-center text-sm font-medium leading-snug whitespace-pre-line break-keep shadow-lg [word-break:keep-all]"
      style={{
        backgroundColor: isPastel ? PRIMARY : "rgba(31, 41, 55, 0.95)",
        color: isPastel ? "#FFFFFF" : "#FFFFFF",
      }}
    >
      {message}
    </div>
  );
}
