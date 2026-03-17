"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "./ToastContext";

/**
 * T3.5-2: 소속 기업 찾기 모달 (수동 검색)
 * - 검색창 + 자동완성
 * - 결과 선택 → user_clients 매핑
 * - 완료 시 "기업정보가 정상 등록되었습니다."
 */

interface Client {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
}

interface Props {
  partnerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (client: Client) => void;
}

export function ClientSearchModal({
  partnerId,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [logoErrorIds, setLogoErrorIds] = useState<Set<string>>(new Set());

  // 거래처 검색
  const searchClients = useCallback(async (searchQuery: string) => {
    if (!partnerId) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/user-clients/search?partnerId=${partnerId}&q=${encodeURIComponent(searchQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients ?? []);
      } else {
        setClients([]);
      }
    } catch {
      setClients([]);
      console.error("Search error");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  // 초기 로드 및 검색
  useEffect(() => {
    if (isOpen && partnerId) {
      searchClients(query);
    }
  }, [isOpen, partnerId, query, searchClients]);

  // 거래처 선택 및 등록
  const handleRegister = async () => {
    if (!selectedClient) return;

    setRegistering(true);

    try {
      const res = await fetch("/api/user-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient.id,
          role: "member", // DB user_clients.role CHECK: 'member' | 'admin'
        }),
      });

      if (res.ok) {
        setRegistered(true);
      } else {
        const data = await res.json();
        toast(data.error || "등록 실패", "error");
      }
    } catch {
      toast("네트워크 오류", "error");
    } finally {
      setRegistering(false);
    }
  };

  // 완료 후 닫기
  const handleComplete = () => {
    if (selectedClient) {
      onSuccess(selectedClient);
    }
    // 상태 초기화
    setQuery("");
    setClients([]);
    setSelectedClient(null);
    setRegistered(false);
    onClose();
  };

  // 모달 닫기
  const handleClose = () => {
    setQuery("");
    setClients([]);
    setSelectedClient(null);
    setRegistered(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "400px",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
            소속 기업 찾기
          </h2>
          <button
            onClick={handleClose}
            style={{
              padding: "4px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: "20px",
              color: "#999",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* 등록 완료 화면 */}
        {registered ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                backgroundColor: "#D1FAE5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12l2 2 4-4"
                  stroke="#059669"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="9" stroke="#059669" strokeWidth="2" />
              </svg>
            </div>
            <p
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "#333",
                marginBottom: "8px",
              }}
            >
              기업정보가 정상 등록되었습니다.
            </p>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#666",
                marginBottom: "24px",
              }}
            >
              {selectedClient?.name}
            </p>
            <button
              onClick={handleComplete}
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
              닫기
            </button>
          </div>
        ) : (
          <>
            {/* 검색 입력 */}
            <div style={{ padding: "16px 20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "#F3F4F6",
                  borderRadius: "8px",
                  padding: "0 12px",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="#9CA3AF" strokeWidth="2" />
                  <path d="M21 21l-4-4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="기업명을 검색하세요"
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    border: "none",
                    backgroundColor: "transparent",
                    fontSize: "0.9375rem",
                    outline: "none",
                  }}
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    style={{
                      padding: "4px",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: "#9CA3AF",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 검색 결과 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                borderTop: "1px solid #E5E7EB",
              }}
            >
              {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  {/* 검색 중... */}
                </div>
              ) : clients.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#999" }}>
                  {query ? "검색 결과가 없습니다." : "기업명을 입력해주세요."}
                </div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {clients.map((client) => (
                    <li
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      style={{
                        padding: "12px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        cursor: "pointer",
                        backgroundColor:
                          selectedClient?.id === client.id ? "#F8F5FF" : "transparent",
                        borderBottom: "1px solid #F3F4F6",
                      }}
                    >
                      {client.logo_url && !logoErrorIds.has(client.id) ? (
                        <img
                          src={client.logo_url}
                          alt={client.name}
                          onError={() =>
                            setLogoErrorIds((prev) => new Set(prev).add(client.id))
                          }
                          style={{
                            width: "40px",
                            height: "40px",
                            objectFit: "contain",
                            borderRadius: "4px",
                            border: "1px solid #E5E7EB",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "4px",
                            backgroundColor: "#E5E7EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#666",
                          }}
                        >
                          {client.name.charAt(0)}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 500, fontSize: "0.9375rem" }}>
                          {client.name}
                        </p>
                      </div>
                      {selectedClient?.id === client.id && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="#D6A8E0" />
                          <path
                            d="M8 12l3 3 5-5"
                            stroke="#fff"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 하단 버튼 */}
            <div
              style={{
                padding: "16px 20px",
                borderTop: "1px solid #E5E7EB",
              }}
            >
              <button
                onClick={handleRegister}
                disabled={!selectedClient || registering}
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: selectedClient ? "#D6A8E0" : "#E5E7EB",
                  color: selectedClient ? "#fff" : "#999",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: selectedClient ? "pointer" : "not-allowed",
                }}
              >
                {"선택 완료"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
