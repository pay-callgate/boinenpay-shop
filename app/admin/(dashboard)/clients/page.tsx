"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Phone, Settings } from "lucide-react";
import { ClientRegistrationModal } from "@/components/admin/ClientRegistrationModal";
import { Call070Modal } from "@/components/admin/Call070Modal";
import { getStorefrontUrl } from "@/lib/app-url";

/**
 * T3-1: 거래처 목록 페이지 (고급 UI)
 * 헤더 - 검색 필터 - 테이블 - 페이징, 꽃집 VIP 파트너 톤
 */

interface Client {
  id: string;
  partner_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  business_registration_number: string | null;
  verification_status: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  call_070_connected: boolean;
  created_at: string;
  client_call_070_configs?: { call_070_number: string }[];
}

const DELIVERY_TYPE_OPTIONS = [
  { value: "", label: "배송 유형 전체" },
  { value: "parcel", label: "택배" },
  { value: "quick", label: "퀵" },
  { value: "pickup", label: "픽업" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "거래 상태 전체" },
  { value: "verified", label: "정상" },
  { value: "rejected", label: "중지" },
  { value: "pending", label: "심사중" },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerSubdomain, setPartnerSubdomain] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const ITEMS_PER_PAGE = 7;
  const [currentPage, setCurrentPage] = useState(1);

  const [show070Modal, setShow070Modal] = useState(false);
  const [selected070Client, setSelected070Client] = useState<Client | null>(null);

  useEffect(() => {
    async function fetchPartner() {
      const res = await fetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) {
          setPartnerId(result.data.id);
          setPartnerSubdomain(result.data.subdomain ?? "");
        } else setPartnerId(null);
      }
    }
    fetchPartner();
  }, []);
  const noPartnerAccess = !loading && partnerId === null;

  const fetchClients = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients?partnerId=${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      } else {
        setError("거래처 조회 실패");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    setCurrentPage(1);
    fetchClients();
  }, [fetchClients]);

  const filteredClients = clients.filter((c) => {
    const matchSearch =
      !search.trim() ||
      c.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (c.business_registration_number || "").replace(/-/g, "").includes(search.trim().replace(/-/g, ""));
    const matchStatus =
      !statusFilter || c.verification_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const clientTotalPages = Math.max(
    1,
    Math.ceil(filteredClients.length / ITEMS_PER_PAGE)
  );
  const displayedClients = filteredClients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까? 연결된 사용자 매핑도 함께 삭제됩니다.")) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) fetchClients();
    else {
      const data = await res.json();
      alert(data.error || "삭제 실패");
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(getStorefrontUrl(partnerSubdomain, slug));
    alert("링크가 복사되었습니다.");
  };

  const open070Modal = (client: Client) => {
    setSelected070Client(client);
    setShow070Modal(true);
  };
  // 070 번호 표시 포맷: 07045070414 → 070-4507-0414
  const format070Display = (num: string) => {
    const digits = num.replace(/\D/g, "");
    if (digits.length >= 11 && digits.startsWith("070")) {
      return `070-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
    }
    if (digits.length >= 8) {
      return `070-${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
    }
    return num;
  };

  const close070Modal = () => {
    setShow070Modal(false);
    setSelected070Client(null);
  };

  const formatRevenue = (value: number) =>
    new Intl.NumberFormat("ko-KR").format(value) + "원";

  const getStatusBadge = (status: string) => {
    if (status === "verified")
      return <span className="rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">정상</span>;
    if (status === "rejected")
      return <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">중지</span>;
    return <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">심사중</span>;
  };

  const getDeliveryBadges = (_client: Client) => {
    return ["택배", "퀵"].map((label) => (
      <Badge key={label} variant="default" className="mr-1 text-xs">
        {label}
      </Badge>
    ));
  };

  return (
    <>
      <ClientRegistrationModal
        open={registrationModalOpen}
        onOpenChange={(open) => {
          if (!open) setEditingClient(null);
          setRegistrationModalOpen(open);
        }}
        partnerId={partnerId}
        subdomain={partnerSubdomain}
        initialData={editingClient}
        onSuccess={fetchClients}
      />
      {show070Modal && selected070Client && (
        <Call070Modal
          clientId={selected070Client.id}
          clientName={selected070Client.name}
          serviceUrl={getStorefrontUrl(partnerSubdomain, selected070Client.slug)}
          isOpen={show070Modal}
          onClose={close070Modal}
          onSuccess={fetchClients}
        />
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-6">
        {/* 상단 고정: 타이틀·필터·총 거래처 수 (스크롤 시 찌그러짐 방지) */}
        <div className="shrink-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">거래처 관리</h1>
            <p className="mt-1 text-sm text-slate-600">
              VIP 파트너 거래처를 조회하고 연동 정보를 관리할 수 있습니다.
            </p>
          </div>

          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="거래처명 또는 사업자번호 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 min-w-[220px] rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
              <select
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                {DELIVERY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-10 rounded-md border border-slate-300 bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-900"
              >
                검색
              </button>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setEditingClient(null);
                    setRegistrationModalOpen(true);
                  }}
                  className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  + 거래처 등록
                </button>
              </div>
            </form>
          </div>

          {error && (
            <p className="mb-3 text-sm text-red-600">{error}</p>
          )}

          {noPartnerAccess && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">파트너 정보를 불러올 수 없습니다.</p>
              <p className="mt-1">
                현재 로그인한 계정이 파트너 관리자로 등록되어 있지 않습니다.
                <strong>partner_admins</strong> 테이블에 현재 사용자와 파트너의 매핑이 있는지 확인해 주세요.
              </p>
            </div>
          )}

          <p className="mb-3 text-sm text-slate-600">총 {filteredClients.length}개 거래처</p>
        </div>

        {/* 테이블 & 페이징: 남는 공간 전부 채움, 본문만 스크롤 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full border-collapse relative">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-[0_1px_0_#e2e8f0]">
                <tr>
                  <th className="w-12 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    거래처명
                  </th>
                  <th className="w-20 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    정보
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">
                    총 매출액
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    거래 내역
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    배송 유형
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    거래 상태
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    CallLink 상세
                  </th>
                  <th className="w-20 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    ⚙️
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                      로딩 중...
                    </td>
                  </tr>
                ) : displayedClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">
                      등록된 거래처가 없습니다.
                    </td>
                  </tr>
                ) : (
                  displayedClients.map((c, idx) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3 text-center text-sm text-slate-500">
                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{c.name}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClient(c);
                            setRegistrationModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center rounded-md bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                          title="거래처 정보 수정"
                        >
                          상세 보기
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-rose-600">
                          {formatRevenue(0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md bg-transparent px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                          </svg>
                          내역 조회
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {getDeliveryBadges(c)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(c.verification_status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const call070Number =
                            c.client_call_070_configs?.[0]?.call_070_number?.trim() || null;
                          if (!call070Number) {
                            return (
                              <button
                                type="button"
                                onClick={() => open070Modal(c)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <svg
                                  className="h-4 w-4 text-slate-500"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                  />
                                </svg>
                                연동 정보
                              </button>
                            );
                          }
                          return (
                            <div className="flex items-center justify-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-sm font-medium text-gray-700">
                                <Phone className="h-3.5 w-3.5 text-gray-500" strokeWidth={2} />
                                {format070Display(call070Number)}
                              </span>
                              <button
                                type="button"
                                onClick={() => open070Modal(c)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                title="연동 수정"
                              >
                                <Settings className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-transparent px-2.5 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50"
                          aria-label="삭제"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
          </table>
        </div>

        {/* 페이징 영역: 테이블 카드 하단에 통합 */}
        {!loading && filteredClients.length > 0 && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              aria-label="맨 처음"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              aria-label="이전"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[4rem] text-center text-sm font-medium text-slate-700">
              {currentPage} / {clientTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(clientTotalPages, p + 1))}
              disabled={currentPage >= clientTotalPages}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              aria-label="다음"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(clientTotalPages)}
              disabled={currentPage >= clientTotalPages}
              className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              aria-label="맨 끝"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
