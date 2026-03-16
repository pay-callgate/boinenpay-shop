"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserClient } from "@/hooks/useUserClient";
import { ClientSearchModal } from "./ClientSearchModal";

/**
 * T3.5-3: 주문 가드 컴포넌트
 * - 미로그인 시 로그인 유도
 * - 로그인했지만 user_clients 없으면 소속 기업 찾기 팝업
 * - 매칭 완료 시 children 렌더링 (주문/결제 가능)
 */

interface Client {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  partner_id: string;
}

interface Props {
  partnerId?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function InlineToast({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none"
      aria-live="polite"
    >
      <div
        className="inline-flex max-w-md items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-xs text-white shadow-lg pointer-events-auto"
        style={{ backdropFilter: "blur(10px)" }}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
        </span>
        <span className="flex-1 text-left">{message}</span>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-900 hover:bg-white"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function OrderGuard({ partnerId, children, fallback }: Props) {
  const params = useParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) ?? "";
  const { data: session, status } = useSession();
  const { isMatched, loading, refresh } = useUserClient(partnerId);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [skipGuard, setSkipGuard] = useState(false);
  const [loopError, setLoopError] = useState<string | null>(null);
  const [showBackgroundToast, setShowBackgroundToast] = useState(true);

  // 미로그인 시 중간 Gate 없이 즉시 거래처 전용 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!subdomain) return;

    // 최근에 너무 자주 리다이렉트되었다면 추가 리다이렉트를 중단하고 에러 메시지 노출
    if (typeof window !== "undefined") {
      const key = "order_guard_redirect_history";
      const now = Date.now();
      const raw = window.sessionStorage.getItem(key);
      const history: number[] = raw ? JSON.parse(raw) : [];
      const recent = history.filter((t) => now - t < 10000); // 최근 10초
      if (recent.length >= 3) {
        setLoopError("로그인과 주문 페이지 사이에서 반복 이동이 감지되었습니다. 새로고침 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.");
        return;
      }
    }

    if (status !== "unauthenticated" || !subdomain) return;
    const callbackUrl = typeof window !== "undefined" ? window.location.href : "";
    const url = `/${subdomain}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    if (typeof window !== "undefined") {
      const key = "order_guard_redirect_history";
      const now = Date.now();
      const raw = window.sessionStorage.getItem(key);
      const history: number[] = raw ? JSON.parse(raw) : [];
      history.push(now);
      window.sessionStorage.setItem(key, JSON.stringify(history.slice(-10)));
    }

    router.replace(url);
  }, [status, subdomain, router]);

  // 미로그인 → useEffect에서 /[subdomain]/login 으로 리다이렉트 중. 리다이렉트 전까지 빈 화면 또는 최소 로딩
  if (status === "unauthenticated") {
    return fallback || null;
  }

  // 로그인했지만 거래처 미매칭
  if (!isMatched && !skipGuard) {
    if (loopError) {
      return (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            color: "#b91c1c",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          {loopError}
        </div>
      );
    }

    return (
      <>
        {/* 본문은 항상 그대로 노출 */}
        {children}

        {/* 하단 토스트로만 가볍게 안내 */}
        <InlineToast
          message="소속 기업 정보를 확인하고 있습니다. 거래처가 없으시면 먼저 등록해 주세요."
          actionLabel="소속 기업 찾기"
          onAction={() => setShowSearchModal(true)}
        />

        {/* 소속 기업 찾기 모달 */}
        <ClientSearchModal
          partnerId={partnerId ?? ""}
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onSuccess={async () => {
            await refresh();
            setSkipGuard(true);
          }}
        />
      </>
    );
  }

  // 매칭 완료 또는 검증 스킵 → children 렌더링
  return (
    <>
      {children}
      {showBackgroundToast && (loading || status === "loading") && (
        <InlineToast
          message="고객님의 소속 정보를 확인하고 있습니다..."
          actionLabel="숨기기"
          onAction={() => setShowBackgroundToast(false)}
        />
      )}
    </>
  );
}
