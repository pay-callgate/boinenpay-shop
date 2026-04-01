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
 * - shopClientId 가 주어지면: DB 소속 거래처와 URL 거래처가 같을 때만 통과 (다른 전용몰 혼선 방지)
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
  /** 현재 쇼핑몰 URL의 거래처 id — 지정 시 user_clients.client_id 와 일치해야 함 */
  shopClientId?: string;
  /** 안내 문구용 현재 전용몰 거래처명 */
  shopClientName?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function OrderGuard({
  partnerId,
  shopClientId,
  shopClientName,
  children,
  fallback,
}: Props) {
  const params = useParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) ?? "";
  const { data: session, status } = useSession();
  const { isMatched, loading, refresh, userClients } = useUserClient(partnerId);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [skipGuard, setSkipGuard] = useState(false);
  const [loopError, setLoopError] = useState<string | null>(null);

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

  // 로딩 중
  if (status === "loading" || loading) {
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

  // 미로그인 → useEffect에서 /[subdomain]/login 으로 리다이렉트 중. 리다이렉트 전까지 빈 화면 또는 최소 로딩
  if (status === "unauthenticated") {
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

  if (affiliationMismatch) {
    const registered = userClients[0];
    const regClient = registered?.clients;
    const regName = regClient?.name?.trim() || "등록된 거래처";
    const regSlug = regClient?.slug?.trim();
    const mallLabel = shopClientName?.trim() || "현재 전용몰";

    const goHomeRegistered =
      regSlug && subdomain
        ? `/${subdomain}/${regSlug}`
        : subdomain
          ? `/${subdomain}`
          : "/";

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
            marginBottom: "20px",
          }}
        >
          이 계정은 <strong>{regName}</strong> 소속으로 등록되어 있습니다.
          <br />
          <strong>{mallLabel}</strong>에서는 마이페이지·주문·장바구니 등을 이용할 수 없습니다.
          <br />
          소속이 맞는 전용몰 링크로 접속하거나, 관리자에게 문의해 주세요.
        </p>
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
            maxWidth: "280px",
          }}
        >
          {regSlug ? `${regName} 전용몰로 이동` : "홈으로"}
        </button>
      </div>
    );
  }

  // 매칭 완료 → children 렌더링
  return <>{children}</>;
}
