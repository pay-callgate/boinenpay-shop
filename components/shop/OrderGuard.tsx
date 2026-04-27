"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useUserClient } from "@/hooks/useUserClient";
import { ClientSearchModal } from "./ClientSearchModal";

/**
 * T3.5-3: 주문 가드 컴포넌트
 * - 기본(requireAuth): 미로그인 시 로그인 유도, user_clients 없으면 소속 기업 찾기
 * - blockAffiliationMismatch: URL 거래처 ≠ DB 소속 시 차단(마이·장바구니·결제 등)
 * - 상품 목록/상세: requireAuth=false, blockAffiliationMismatch=false 로 탐색만 허용(구매는 API·모달로 방어)
 * - 비회원 주문(guest-order): requireAuth=false, blockAffiliationMismatch=false — 타 소속 로그인 상태에서도 비회원 결제 허용
 * - checkout?guest=1: blockAffiliationMismatch=false 동일
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
  /** 현재 쇼핑몰 URL의 거래처 id — 지정 시 user_clients.client_id 와 일치해야 함 */
  shopClientId?: string;
  /** 안내 문구용 현재 전용몰 거래처명 */
  shopClientName?: string;
  /**
   * false: 미로그인·거래처 미매칭으로도 children 노출 (상품 목록/상세 탐색 전용).
   * 리다이렉트·소속 기업 찾기 게이트 생략.
   * @default true
   */
  requireAuth?: boolean;
  /**
   * false: URL 거래처 ≠ DB 소속일 때 차단 UI 미표시 (탐색 허용). 주문/장바구니는 API로 방어.
   * @default true
   */
  blockAffiliationMismatch?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function OrderGuard({
  partnerId,
  shopClientId,
  shopClientName,
  requireAuth = true,
  blockAffiliationMismatch = true,
  children,
  fallback,
}: Props) {
  const params = useParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) ?? "";
  const clientSlugFromUrl = (params?.clientSlug as string | undefined) ?? "";
  const { data: session, status } = useSession();
  const { isMatched, loading, refresh, userClients } = useUserClient(partnerId);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [skipGuard, setSkipGuard] = useState(false);
  const [loopError, setLoopError] = useState<string | null>(null);
  const [autoBindFailed, setAutoBindFailed] = useState(false);
  const autoBindStartedRef = useRef(false);

  const canAutoBind =
    status === "authenticated" &&
    requireAuth !== false &&
    !!partnerId &&
    !!shopClientId &&
    !!clientSlugFromUrl &&
    clientSlugFromUrl !== "_preview";

  useEffect(() => {
    if (isMatched) {
      autoBindStartedRef.current = false;
      setAutoBindFailed(false);
    }
  }, [isMatched]);

  useEffect(() => {
    if (!canAutoBind || loading || isMatched || autoBindFailed) return;
    if (autoBindStartedRef.current) return;
    autoBindStartedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/shop/auth/bind-client", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId,
            clientSlug: clientSlugFromUrl,
          }),
        });
        if (cancelled) return;
        if (res.ok) {
          await refresh();
          console.log("[OrderGuard] auto-bind OK", {
            partnerId,
            clientSlug: clientSlugFromUrl,
          });
        } else {
          let staleSession = false;
          try {
            const body = (await res.json()) as { code?: string };
            staleSession = body?.code === "STALE_SESSION";
          } catch {
            /* ignore */
          }
          if (staleSession && typeof window !== "undefined" && subdomain) {
            try {
              await signOut({ redirect: false });
            } catch {
              /* still navigate to login */
            }
            const returnTo = `${window.location.pathname}${window.location.search}`;
            router.replace(
              `/${subdomain}/login?callbackUrl=${encodeURIComponent(returnTo)}`
            );
            return;
          }
          setAutoBindFailed(true);
          console.warn("[OrderGuard] auto-bind failed", res.status);
        }
      } catch {
        if (!cancelled) {
          setAutoBindFailed(true);
          console.warn("[OrderGuard] auto-bind error");
        }
      }
    })();
    return () => {
      cancelled = true;
      autoBindStartedRef.current = false;
    };
  }, [
    canAutoBind,
    loading,
    isMatched,
    partnerId,
    clientSlugFromUrl,
    refresh,
    autoBindFailed,
  ]);

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

    if (requireAuth === false) return;
    if (status !== "unauthenticated" || !subdomain) return;
    const callbackUrl =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "";
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
  }, [status, subdomain, router, requireAuth]);

  // 로딩 중 — 탐색 전용: 비로그인이면 user_clients 대기 없이 통과
  const waitUserClients = requireAuth !== false || status === "authenticated";
  if (status === "loading" || (waitUserClients && loading)) {
    return (
      fallback || (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#999",
          }}
        >
          {/* 확인 중... */}
        </div>
      )
    );
  }

  // 미로그인 → useEffect에서 /[subdomain]/login 으로 리다이렉트 중. 탐색 전용(requireAuth false)은 children 그대로
  if (status === "unauthenticated") {
    if (requireAuth === false) {
      return <>{children}</>;
    }
    return (
      <div
        style={{
          padding: "40px 24px",
          textAlign: "center",
          color: "#999",
          fontSize: "0.875rem",
        }}
      >
        {/* 로그인 페이지로 이동 중... */}
      </div>
    );
  }

  const showAutoBindSpinner =
    requireAuth !== false &&
    !isMatched &&
    !skipGuard &&
    canAutoBind &&
    !autoBindFailed;

  if (showAutoBindSpinner) {
    return (
      fallback || (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#999",
          }}
        >
          {/* 소속 연결 중... */}
        </div>
      )
    );
  }

  // 로그인했지만 거래처 미매칭 (탐색 전용에서는 게이트 생략)
  if (requireAuth !== false && !isMatched && !skipGuard) {
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
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 9v4M12 17h.01"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            소속 기업 등록이 필요합니다
          </h3>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#666",
              marginBottom: "24px",
              lineHeight: 1.6,
            }}
          >
            주문을 진행하시려면 먼저 소속 기업을 등록해주세요.
            <br />
            기업 등록 후 전용 혜택을 받으실 수 있습니다.
          </p>
          <button
            onClick={() => setShowSearchModal(true)}
            style={{
              padding: "14px 32px",
              backgroundColor: "#D6A8E0",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            소속 기업 찾기
          </button>
        </div>

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

  // 같은 파트너 소속이지만, URL 거래처 ≠ DB 등록 소속 → 전용몰 혼동 방지
  const affiliationMismatch =
    !!shopClientId &&
    userClients.length > 0 &&
    !userClients.some((uc) => uc.client_id === shopClientId);

  if (blockAffiliationMismatch !== false && affiliationMismatch) {
    const registered = userClients[0];
    const regClient = registered?.clients;
    const regName = regClient?.name?.trim() || "등록된 거래처";
    const regSlug = regClient?.slug?.trim();
    const mallLabel = shopClientName?.trim() || "현재 전용몰";
    const userEmail =
      typeof session?.user?.email === "string" && session.user.email.trim() !== ""
        ? session.user.email.trim()
        : null;

    const goHomeRegistered =
      regSlug && subdomain
        ? `/${subdomain}/${regSlug}`
        : subdomain
          ? `/${subdomain}`
          : "/";

    const handleLoginAsAnotherAccount = async () => {
      if (typeof window === "undefined" || !subdomain) return;
      const origin = window.location.origin;
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const loginPath = `/${subdomain}/login?callbackUrl=${encodeURIComponent(returnTo)}`;
      const loginUrl = `${origin}${loginPath}`;
      try {
        await signOut({ redirect: false });
      } catch {
        // 세션 해제 실패해도 로그인 화면으로 이동 (쿠키 정리는 서버가 처리)
      }
      if (typeof window !== "undefined") {
        window.location.replace(loginUrl);
      }
    };

    return (
      <div
        style={{
          padding: "40px 24px",
          textAlign: "center",
          maxWidth: "420px",
          margin: "0 auto",
        }}
      >
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 700,
            marginBottom: "12px",
            color: "#1e293b",
          }}
        >
          소속 거래처가 다른 전용몰입니다
        </h3>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#475569",
            lineHeight: 1.7,
            marginBottom: "16px",
          }}
        >
          {userEmail ? (
            <>
              지금 브라우저에 로그인된 계정은 <strong style={{ wordBreak: "break-all" }}>{userEmail}</strong>
              입니다.
              <br />
            </>
          ) : (
            <>
              현재 계정의 이메일을 표시할 수 없습니다. (SNS 로그인 등)
              <br />
            </>
          )}
          이 계정은 <strong>{regName}</strong> 소속으로 등록되어 있습니다.
          <br />
          <strong>{mallLabel}</strong>에서는 마이페이지·주문·장바구니 등을 이용할 수 없습니다.
          <br />
          소속이 맞는 전용몰 링크로 접속하거나, 관리자에게 문의해 주세요.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            maxWidth: "280px",
            margin: "0 auto",
          }}
        >
          <button
            type="button"
            onClick={() => router.replace(goHomeRegistered)}
            style={{
              padding: "14px 28px",
              backgroundColor: "#D6A8E0",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {regSlug ? `${regName} 전용몰로 이동` : "홈으로"}
          </button>
          <button
            type="button"
            onClick={() => void handleLoginAsAnotherAccount()}
            style={{
              padding: "14px 28px",
              backgroundColor: "#fff",
              color: "#5B21B6",
              border: "2px solid #D6A8E0",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              width: "100%",
            }}
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  // 매칭 완료 → children 렌더링
  return <>{children}</>;
}
