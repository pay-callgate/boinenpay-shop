"use client";

import React, { Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const NEXTAUTH_ERROR_MESSAGES: Record<string, string> = {
  Config:
    "서버 설정(Supabase URL·Service Role 키 등)을 확인해 주세요. .env.local을 점검한 뒤 개발 서버를 재시작하세요.",
  OAuthSignin: "OAuth 로그인 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  OAuthCallback: "OAuth 콜백 처리에 실패했습니다. NEXTAUTH_URL이 브라우저 주소(포트 포함)와 일치하는지 확인해 주세요.",
  OAuthAccountNotLinked: "이미 다른 방식으로 가입된 이메일일 수 있습니다.",
  AccessDenied: "접근이 거부되었습니다.",
  SessionRequired: "로그인이 필요합니다.",
  Default: "로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
};

function AdminLoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") ?? "/admin";
  const errorCode = searchParams?.get("error")?.trim() ?? null;
  const errorMessage = errorCode
    ? NEXTAUTH_ERROR_MESSAGES[errorCode] ?? NEXTAUTH_ERROR_MESSAGES.Default
    : null;

  useEffect(() => {
    console.log("[AdminLogin] mount", {
      callbackUrl,
      hasCallbackUrlParam: searchParams?.has("callbackUrl"),
      error: searchParams?.get("error") ?? null,
    });
  }, [callbackUrl, searchParams]);

  const handleSignIn = (provider: "kakao" | "naver") => {
    console.log("[AdminLogin] handleSignIn called", { provider, callbackUrl });
    signIn(provider, { callbackUrl })
      .then((res) => {
        console.log("[AdminLogin] signIn result", res);
      })
      .catch((err) => {
        console.error("[AdminLogin] signIn error", err);
      });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FA] p-6"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F5F7FA",
        padding: "24px",
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg overflow-hidden shadow-lg"
        style={{
          width: "100%",
          maxWidth: "24rem",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
          margin: "0 auto",
        }}
      >
        {/* CI Header */}
        <div
          className="bg-gradient-to-r from-[#4A90D9] to-[#357ABD] p-8"
          style={{
            background: "linear-gradient(135deg, #4A90D9 0%, #357ABD 100%)",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          {/* Shopping Cart Icon */}
          <div style={{ marginBottom: "12px" }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 64 64"
              style={{ margin: "0 auto", display: "block" }}
            >
              <circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.2)" />
              <path
                fill="#fff"
                d="M20 18h-4a2 2 0 0 0 0 4h2l4 16a3 3 0 0 0 3 2h14a3 3 0 0 0 3-2l4-14H24l1 4h14l-2 8H26l-3-12h-3z"
              />
              <circle cx="26" cy="46" r="3" fill="#fff" />
              <circle cx="38" cy="46" r="3" fill="#fff" />
              <path
                fill="#FFD93D"
                d="M44 24l-2 2-2-2 2-2zM40 20l-1.5 1.5L37 20l1.5-1.5z"
              />
            </svg>
          </div>
          <h1
            style={{
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            CallLink Shopping
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.85)",
              fontSize: "0.75rem",
              marginTop: "4px",
              fontWeight: 400,
            }}
          >
            Partner Admin Portal
          </p>
        </div>

        {/* Login Form */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "2rem",
          }}
        >
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left text-xs text-red-800"
            >
              {errorMessage}
            </div>
          )}
          <p
            className="text-center text-sm text-[#666666]"
            style={{ fontSize: "0.875rem", color: "#666", textAlign: "center", marginBottom: "1.5rem" }}
          >
            Partner Admin
          </p>
          <div
            className="flex flex-col gap-3"
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
          <button
            type="button"
            onClick={() => handleSignIn("kakao")}
            className="flex items-center justify-center gap-3 rounded-md bg-[#FEE500] px-4 py-3 text-sm font-medium text-[#191919] hover:bg-[#FDD835]"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "6px",
              backgroundColor: "#FEE500",
              color: "#191919",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {/* Kakao Talk Icon */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#3C1E1E" d="M24 4C12.95 4 4 11.16 4 20c0 5.6 3.6 10.52 9.04 13.36-.4 1.48-1.44 5.36-1.64 6.2-.24 1.04.4 1.04.84.76.36-.24 5.6-3.8 7.88-5.32 1.28.16 2.6.24 3.92.24 11.04 0 20-7.16 20-16S35.04 4 24 4z"/>
            </svg>
            카카오톡 계정으로 가입하기
          </button>
          <button
            type="button"
            onClick={() => handleSignIn("naver")}
            className="flex items-center justify-center gap-3 rounded-md bg-[#03C75A] px-4 py-3 text-sm font-medium text-white hover:bg-[#02b350]"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "12px 16px",
              borderRadius: "6px",
              backgroundColor: "#03C75A",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {/* Naver N Icon */}
            <svg width="20" height="20" viewBox="0 0 48 48">
              <rect width="48" height="48" rx="6" fill="#03C75A"/>
              <path fill="#fff" d="M16 14h5.2l5.6 9.6V14H32v20h-5.2l-5.6-9.6V34H16V14z"/>
            </svg>
            네이버 계정으로 가입하기
          </button>
          </div>
          <p
            className="mt-6 text-center text-xs text-[#666666]"
            style={{ marginTop: "1.5rem", fontSize: "12px", color: "#666", textAlign: "center" }}
          >
            로그인 시 기업 등록·검증 후 대시보드를 이용할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * T1-1: 파트너 어드민 로그인 페이지 (중앙 집중형).
 * SNS(카카오·네이버) 로그인 후 callbackUrl로 리다이렉트.
 * useSearchParams는 Suspense 경계 필요.
 */
export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F7FA] p-6">
          <p className="text-[#666]"></p>
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
