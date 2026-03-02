"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";

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
  const { data: session } = useSession();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
  });

  // 회원정보 조회 (Context 준비 후 실행, clientId 필수)
  useEffect(() => {
    if (!partner?.id || !client?.id) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await shopFetch(`/api/mypage/profile?clientId=${client.id}`);
        if (cancelled) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("[mypage/profile] 조회 실패:", res.status, err?.error ?? res.statusText);
          return;
        }

        const data = await res.json();
        if (!data?.user) return;

        setUser(data.user);
        setFormData({
          name: data.user.name,
          phone: data.user.phone || "",
        });
      } catch (e) {
        if (!cancelled) {
          console.error("[mypage/profile] 네트워크 오류:", e);
          alert("네트워크 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [partner?.id, client?.id]);

  // 회원정보 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert("이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const res = await shopFetch(`/api/mypage/profile?clientId=${client!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert("회원정보가 수정되었습니다.");
        const data = await res.json();
        setUser(data.user);
      } else {
        const error = await res.json().catch(() => ({}));
        console.error("[mypage/profile] 수정 실패:", res.status, error?.error ?? res.statusText);
        alert(error?.error || "회원정보 수정에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
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
        <p style={{ color: "#666" }}>로딩 중...</p>
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
        <p style={{ color: "#666" }}>로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <OrderGuard partnerId={partner.id}>
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
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            사용자 정보를 불러올 수 없습니다
          </h1>
        </div>
      </OrderGuard>
    );
  }

  return (
    <OrderGuard partnerId={partner.id}>
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
              {saving ? "저장 중..." : "저장하기"}
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
