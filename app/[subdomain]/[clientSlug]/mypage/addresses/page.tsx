"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";

/**
 * T6-3: 배송지 관리 (통합 배송지 — clientId 미사용)
 * /{subdomain}/{clientSlug}/mypage/addresses
 * partner/client는 ShopTemplateContext에서 사용.
 */

interface Address {
  id: string;
  name: string;
  phone: string;
  postcode: string | null;
  address: string;
  detail: string | null;
  is_default: boolean;
}

export default function AddressesPage() {
  const params = useParams();
  const router = useRouter();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const clientSlug = params?.clientSlug as string;
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    postcode: "",
    address: "",
    detail: "",
    isDefault: false,
  });


  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  // 배송지 목록 조회 (Context 준비 후 실행, 통합 배송지이므로 clientId 미전달)
  const refetchAddresses = () => {
    setLoading(true);
    fetch(`/api/mypage/addresses`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAddresses(data?.addresses ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!partner?.id || !client?.id) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/mypage/addresses`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setAddresses(data?.addresses ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partner?.id, client?.id]);

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      postcode: "",
      address: "",
      detail: "",
      isDefault: false,
    });
    setEditingAddress(null);
    setShowForm(false);
  };

  // 수정 모드
  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      name: address.name,
      phone: address.phone,
      postcode: address.postcode || "",
      address: address.address,
      detail: address.detail || "",
      isDefault: address.is_default,
    });
    setShowForm(true);
  };

  // 배송지 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.address) {
      alert("배송지 정보를 모두 입력해주세요.");
      return;
    }

    try {
      if (editingAddress) {
        // 수정
        const res = await fetch(`/api/mypage/addresses/${editingAddress.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          alert("배송지가 수정되었습니다.");
          resetForm();
          refetchAddresses();
        } else {
          const error = await res.json();
          alert(error.error || "배송지 수정에 실패했습니다.");
        }
      } else {
        // 추가
        const res = await fetch(`/api/mypage/addresses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          alert("배송지가 추가되었습니다.");
          resetForm();
          refetchAddresses();
        } else {
          const error = await res.json();
          alert(error.error || "배송지 추가에 실패했습니다.");
        }
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  // 배송지 삭제 (수정 페이지에서 사용; 목록에서는 삭제 버튼 없음)
  const handleDelete = async (id: string) => {
    if (!confirm("이 배송지를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/mypage/addresses/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("배송지가 삭제되었습니다.");
        refetchAddresses();
      } else {
        const error = await res.json();
        alert(error.error || "배송지 삭제에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
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

  return (
    <OrderGuard partnerId={partner.id}>
      <div
        style={{
          maxWidth: "430px",
          margin: "0 auto",
          minHeight: "100vh",
          backgroundColor: "#F5F5F5",
          paddingBottom: "80px",
        }}
      >
        {/* 헤더 */}
        <header
          style={{
            padding: "16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "#fff",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <button
            onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage`)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="#333"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700, flex: 1 }}>
            배송 주소록 관리
          </h1>
        </header>

        {/* 배송지 추가/수정 폼 */}
        {showForm && (
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px 16px",
              marginBottom: "12px",
              borderBottom: "1px solid #E5E7EB",
            }}
          >
            <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "16px" }}>
              {editingAddress ? "배송지 수정" : "배송지 추가"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  받는 분 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="이름"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                    fontSize: "0.9375rem",
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  연락처 *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                    fontSize: "0.9375rem",
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  우편번호
                </label>
                <input
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  placeholder="12345"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                    fontSize: "0.9375rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  주소 *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="서울시 강남구 테헤란로 123"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                    fontSize: "0.9375rem",
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  상세 주소
                </label>
                <input
                  type="text"
                  value={formData.detail}
                  onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
                  placeholder="동/호수 등"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                    fontSize: "0.9375rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) =>
                      setFormData({ ...formData, isDefault: e.target.checked })
                    }
                    style={{ width: "16px", height: "16px" }}
                  />
                  <span style={{ fontSize: "0.875rem" }}>기본 배송지로 설정</span>
                </label>
              </div>

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: "#D6A8E0",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {editingAddress ? "수정하기" : "추가하기"}
              </button>
            </form>
          </div>
        )}

        {/* 배송지 목록 */}
        {loading ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#999" }}>로딩 중...</p>
          </div>
        ) : addresses.length === 0 ? (
          <div
            style={{
              padding: "60px 16px 140px",
              textAlign: "center",
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              style={{ margin: "0 auto 16px" }}
            >
              <path
                d="M12 2L2 7v10c0 5.5 3.84 9.64 10 11 6.16-1.36 10-5.5 10-11V7l-10-5z"
                stroke="#D1D5DB"
                strokeWidth="2"
                fill="none"
              />
              <path d="M12 11v6M12 8h.01" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: "1rem", color: "#666" }}>
              등록된 배송지가 없습니다
            </p>
          </div>
        ) : (
          <div style={{ padding: "16px", paddingBottom: "140px" }}>
            {addresses.map((address) => (
              <div
                key={address.id}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  padding: "16px",
                  marginBottom: "12px",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {address.name}
                  {address.is_default && (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        backgroundColor: "#F5E6F8",
                        color: "#9B6B9B",
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        borderRadius: "4px",
                      }}
                    >
                      기본
                    </span>
                  )}
                </p>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "4px" }}>
                  {address.phone}
                </p>
                <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "12px", lineHeight: 1.4 }}>
                  {address.postcode && `[${address.postcode}] `}
                  {address.address}
                  {address.detail && ` ${address.detail}`}
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage/addresses/${address.id}`)}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "transparent",
                    color: "#9CA3AF",
                    border: "1px solid #E5E7EB",
                    borderRadius: "6px",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  수정
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 메인 CTA: [+ 새 배송지 추가] — 상품 상세 [구매하기]와 동일하게 하단 고정, 연보라 풀폭 */}
        {!loading && (
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: BOTTOM_NAV_HEIGHT,
              maxWidth: "430px",
              margin: "0 auto",
              zIndex: 50,
              padding: "12px 16px",
              backgroundColor: "#fff",
              borderTop: "1px solid #E5E7EB",
            }}
          >
            <button
              type="button"
              onClick={() => router.push(`/${subdomain}/${clientSlug}/mypage/addresses/new`)}
              style={{
                width: "100%",
                padding: "14px 16px",
                backgroundColor: "#D6A8E0",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "1.125rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              + 새 배송지 추가
            </button>
          </div>
        )}

        {/* Bottom Nav */}
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            maxWidth: "430px",
            margin: "0 auto",
            backgroundColor: "#FDF2F8",
            display: "flex",
            justifyContent: "space-around",
            padding: "12px 0",
            borderTop: "1px solid #E5E7EB",
          }}
        >
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
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                fontSize: "0.75rem",
                color: item.active ? "#D6A8E0" : "#666",
                fontWeight: item.active ? 600 : 400,
              }}
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
