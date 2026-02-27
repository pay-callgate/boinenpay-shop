"use client";

import { useState, useEffect } from "react";
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

export function OrderGuard({ partnerId, children, fallback }: Props) {
  const params = useParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) ?? "";
  const { data: session, status } = useSession();
  const { isMatched, loading, refresh } = useUserClient(partnerId);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [skipGuard, setSkipGuard] = useState(false);

  // 미로그인 시 중간 Gate 없이 즉시 거래처 전용 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (status !== "unauthenticated" || !subdomain) return;
    const callbackUrl = typeof window !== "undefined" ? window.location.href : "";
    const url = `/${subdomain}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
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
          확인 중...
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
        로그인 페이지로 이동 중...
      </div>
    );
  }

  // 로그인했지만 거래처 미매칭
  if (!isMatched && !skipGuard) {
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

  // 매칭 완료 → children 렌더링
  return <>{children}</>;
}
