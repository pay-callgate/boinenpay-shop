"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserClient } from "@/hooks/useUserClient";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import {
  parseShopJsonResponse,
  type RegisteredClientHint,
  type ShopApiErrorBody,
} from "@/lib/shop-api-error";

/**
 * T6-4: 회원정보 수정
 * /{subdomain}/{clientSlug}/mypage/profile
 * partner/client는 ShopTemplateContext에서 사용.
 */

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;
  const { isMatched, loading: ucLoading, refresh } = useUserClient(partner?.id);

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** 조회 실패 시 HTTP 상태 + API body (403 시 registeredClient 포함) */
  const [loadIssue, setLoadIssue] = useState<{
    status: number;
    body: ShopApiErrorBody;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  /** 같은 몰에서 인라인 bind-client 1회 (OrderGuard와 레이스 시 프로필이 먼저 나가는 것 방지) */
  const profileBindIssuedRef = useRef(false);

  useEffect(() => {
    profileBindIssuedRef.current = false;
  }, [session?.user?.id, partner?.id, clientSlug]);

  /**
   * 회원정보 조회: 세션 확정 + user_clients 로딩 완료 후,
   * 미소속이면 bind-client → refresh → isMatched 된 뒤 재실행되어 조회.
   */
  useEffect(() => {
    if (!partner?.id || !client?.id) return;

    if (sessionStatus === "loading") return;
    if (sessionStatus === "unauthenticated") {
      setLoading(false);
      setUser(null);
      setLoadIssue(null);
      return;
    }

    if (ucLoading) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadIssue(null);

      if (
        !isMatched &&
        clientSlug &&
        clientSlug !== "_preview" &&
        !profileBindIssuedRef.current
      ) {
        profileBindIssuedRef.current = true;
        try {
          const res = await fetch("/api/shop/auth/bind-client", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partnerId: partner.id,
              clientSlug,
            }),
          });
          if (cancelled) return;
          if (res.ok) {
            await refresh();
            setUser(null);
            setLoadIssue(null);
            return;
          }
        } catch {
          /* 아래에서 프로필 조회로 403 힌트 확보 */
        }
      }

      try {
        const res = await shopFetch(`/api/mypage/profile?clientId=${client.id}`, {
          handleSessionExpiry: false,
        });
        if (cancelled) return;

        const parsed = await parseShopJsonResponse<{ user: User | null }>(res);
        if (!parsed.ok) {
          console.warn(
            "[mypage/profile] 조회 실패:",
            parsed.status,
            parsed.body?.error ?? res.statusText
          );
          setUser(null);
          setLoadIssue({ status: parsed.status, body: parsed.body });
          if (parsed.status === 500) {
            toast(
              "일시적인 오류로 회원정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
              "error"
            );
          }
          return;
        }

        const u = parsed.data.user;
        if (!u || typeof u !== "object" || !u.id || typeof u.email !== "string") {
          setUser(null);
          setLoadIssue({
            status: 404,
            body: {
              error:
                "회원 정보를 찾을 수 없습니다. 문제가 계속되면 관리자에게 문의해 주세요.",
            },
          });
          return;
        }

        setUser(u);
        setFormData({
          name: u.name ?? "",
          phone: u.phone || "",
        });
        setLoadIssue(null);
      } catch (e) {
        if (e instanceof Error && e.message === "SESSION_EXPIRED") return;
        if (!cancelled) {
          console.warn("[mypage/profile] 네트워크 오류:", e);
          toast("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", "error");
          setUser(null);
          setLoadIssue({
            status: 0,
            body: { error: "네트워크 오류가 발생했습니다." },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    partner?.id,
    client?.id,
    clientSlug,
    sessionStatus,
    session?.user?.id,
    ucLoading,
    isMatched,
    refresh,
  ]);

  // 회원정보 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast("이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const res = await shopFetch(`/api/mypage/profile?clientId=${client!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const parsed = await parseShopJsonResponse<{ user?: User }>(res);
      if (parsed.ok) {
        toast("회원정보가 수정되었습니다.", "success");
        if (parsed.data.user?.id) setUser(parsed.data.user as User);
      } else {
        console.warn("[mypage/profile] 수정 실패:", parsed.status, parsed.body?.error);
        if (parsed.status === 403) {
          const rc = parsed.body.registeredClient;
          const msg = rc?.name?.trim()
            ? `이 전용몰에서는 회원정보를 수정할 수 없습니다. ${rc.name} 몰에 등록되어 있습니다. 소속 거래처 전용몰인 ${rc.name}에서 이용해 주세요.`
            : parsed.body.error || "회원정보를 수정할 수 없습니다.";
          toast(msg, "error");
        } else {
          toast(parsed.body.error || "회원정보 수정에 실패했습니다.", "error");
        }
      }
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (template == null || !partner || !client) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <p style={{ color: "#666" }}></p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F5F5",
        }}
      >
        <p style={{ color: "#666" }}></p>
      </div>
    );
  }

  if (!user) {
    const rc: RegisteredClientHint | null | undefined = loadIssue?.body.registeredClient;
    const registeredHref =
      rc?.partnerSubdomain && rc.slug
        ? `/${rc.partnerSubdomain}/${rc.slug}/mypage/profile`
        : null;

    return (
      <OrderGuard
        partnerId={partner.id}
        shopClientId={client?.id}
        shopClientName={client?.name ?? undefined}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F5F5F5",
            padding: "24px",
            textAlign: "center",
          }}
        >
          {loadIssue?.status === 403 ? (
            <>
              <h1
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: "12px",
                  lineHeight: 1.5,
                }}
              >
                이 전용몰에서는 회원정보를 조회할 수 없습니다
              </h1>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#475569",
                  lineHeight: 1.7,
                  marginBottom: "16px",
                  maxWidth: "320px",
                }}
              >
                소속 거래처 전용몰에서 이용해 주세요.
                {rc?.name ? (
                  <>
                    <br />
                    <br />
                    <strong>{rc.name}</strong> 몰에 등록되어 있습니다.
                    <br />
                    소속 거래처 전용몰인 <strong>{rc.name}</strong>에서 회원정보를
                    확인해 주세요.
                  </>
                ) : (
                  <>
                    <br />
                    <br />
                    (이 계정에 연결된 소속 거래처 정보를 찾지 못했습니다. 관리자에게
                    문의해 주세요.)
                  </>
                )}
              </p>
              {registeredHref ? (
                <button
                  type="button"
                  onClick={() => router.replace(registeredHref!)}
                  style={{
                    padding: "14px 28px",
                    backgroundColor: "#D6A8E0",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    maxWidth: "280px",
                    width: "100%",
                  }}
                >
                  {rc?.name ? `${rc.name} 회원정보로 이동` : "소속 몰로 이동"}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}>
                {loadIssue?.status === 404
                  ? "회원 정보를 찾을 수 없습니다"
                  : loadIssue?.status === 400
                    ? "잘못된 요청입니다"
                    : "회원정보를 불러오지 못했습니다"}
              </h1>
              <p
                style={{
                  marginTop: "12px",
                  fontSize: "0.875rem",
                  color: "#64748b",
                  lineHeight: 1.6,
                  maxWidth: "320px",
                }}
              >
                {loadIssue?.body?.error ||
                  "일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요."}
              </p>
            </>
          )}
        </div>
      </OrderGuard>
    );
  }

  return (
    <OrderGuard
      partnerId={partner.id}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
    >
      <div className="flex flex-col min-h-screen bg-slate-50 max-w-[430px] mx-auto pb-[76px] relative">
        {/* 헤더 */}
        <header className="shrink-0 flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage`)}
            className="p-0 border-0 bg-transparent cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-800">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-lg font-bold flex-1">회원정보 수정</h1>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 bg-white">
        {/* 프로필 카드 */}
        <div
          style={{
            backgroundColor: "#fff",
            padding: "24px 16px",
            marginBottom: "12px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "#D6A8E0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "2rem",
              fontWeight: 700,
              margin: "0 auto 16px",
            }}
          >
            {user.name.charAt(0)}
          </div>
          <p style={{ fontSize: "0.875rem", color: "#999" }}>
            {user.email}
          </p>
        </div>

        {/* 회원정보 폼 — 입력 포커스 시 파스텔 연보라 톤 */}
        <style dangerouslySetInnerHTML={{ __html: ".mypage-profile-input:focus { outline: none; border-color: #D6A8E0 !important; box-shadow: 0 0 0 2px rgba(214,168,224,0.25); }" }} />
        <div
          style={{
            backgroundColor: "#fff",
            padding: "20px 16px",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                이름 *
              </label>
              <input
                type="text"
                className="mypage-profile-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="이름"
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "1rem",
                }}
                required
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                이메일
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  backgroundColor: "#F9FAFB",
                  color: "#999",
                }}
              />
              <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "4px" }}>
                이메일은 수정할 수 없습니다.
              </p>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  marginBottom: "8px",
                }}
              >
                연락처
              </label>
              <input
                type="tel"
                className="mypage-profile-input"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="010-1234-5678"
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "1rem",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                padding: "14px 16px",
                backgroundColor: saving ? "#D1D5DB" : "#D6A8E0",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "1.125rem",
                fontWeight: 500,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {"저장하기"}
            </button>
          </form>
        </div>
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white flex justify-around py-3 border-t border-gray-200">
          {[
            { icon: "🏠", label: "홈", path: "" },
            { icon: "📂", label: "카테고리", path: "/products" },
            { icon: "🛒", label: "장바구니", path: "/cart" },
            { icon: "👤", label: "마이페이지", path: "/mypage", active: true },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() =>
                router.push(`/${subdomain}/${clientSlug}${item.path}`)
              }
              className="flex flex-col items-center gap-1 cursor-pointer text-xs border-0 bg-transparent"
              style={{ color: item.active ? "#D6A8E0" : "#666", fontWeight: item.active ? 600 : 400 }}
            >
              <span style={{ fontSize: "1.25rem" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </OrderGuard>
  );
}
