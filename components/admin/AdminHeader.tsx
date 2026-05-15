"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { usePartnerSettingsModal } from "@/components/admin/PartnerSettingsModalContext";
import { adminFetch } from "@/lib/admin-fetch";

/** Heroicons Cog-6-tooth (outline) */
function CogIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

/**
 * T1-4: 파트너 어드민 헤더 (TRD §3.5)
 * 우측: 뉴런 연동 테스트, 파트너 설정(모달), 로그아웃
 * 중앙 집중형: /admin 기준 링크만 사용.
 */
export function AdminHeader() {
  const { openPartnerSettings } = usePartnerSettingsModal();
  const [devAutoSubmit, setDevAutoSubmit] = useState<{
    toggleAvailable: boolean;
    enabled: boolean;
  } | null>(null);
  const [devAutoSaving, setDevAutoSaving] = useState(false);

  const loadDevAuto = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/dev/newrun-auto-submit");
      if (!res.ok) return;
      const data = (await res.json()) as {
        toggleAvailable?: boolean;
        autoSubmitEnabled?: boolean;
      };
      setDevAutoSubmit({
        toggleAvailable: data.toggleAvailable === true,
        enabled: data.autoSubmitEnabled !== false,
      });
    } catch {
      setDevAutoSubmit(null);
    }
  }, []);

  useEffect(() => {
    void loadDevAuto();
  }, [loadDevAuto]);

  const toggleDevAuto = async () => {
    if (!devAutoSubmit?.toggleAvailable || devAutoSaving) return;
    const next = !devAutoSubmit.enabled;
    setDevAutoSaving(true);
    try {
      const res = await adminFetch("/api/admin/dev/newrun-auto-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error || "설정 저장에 실패했습니다.");
        return;
      }
      setDevAutoSubmit((s) =>
        s ? { ...s, enabled: next } : { toggleAvailable: true, enabled: next }
      );
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setDevAutoSaving(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-black px-4 text-white">
      <Link href="/admin" className="text-lg font-bold">
        Partner Admin
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link
          href="/admin/settings/integrations"
          className="hover:underline"
        >
          뉴런 연동 테스트
        </Link>
        {devAutoSubmit?.toggleAvailable ? (
          <>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-gray-300">우리부고 자동발주</span>
              <button
                type="button"
                role="switch"
                aria-checked={devAutoSubmit.enabled}
                disabled={devAutoSaving}
                onClick={() => void toggleDevAuto()}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 ${
                  devAutoSubmit.enabled ? "bg-emerald-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    devAutoSubmit.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs text-gray-300">
                {devAutoSubmit.enabled ? "ON" : "OFF"}
              </span>
            </div>
          </>
        ) : null}
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={openPartnerSettings}
          className="flex items-center gap-1.5 hover:underline"
        >
          <CogIcon className="h-5 w-5" />
          <span>파트너 설정</span>
        </button>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="hover:underline"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
