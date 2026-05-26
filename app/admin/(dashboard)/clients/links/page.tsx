"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Link as LinkIcon, Link2, MessageSquare, Phone, Settings } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/badge";
import { ClientRegistrationModal } from "@/components/admin/ClientRegistrationModal";
import { CallcloudIntegrationModal, type CallcloudModalEntry } from "@/components/admin/CallcloudIntegrationModal";
import { LinkNotificationModal } from "@/components/admin/LinkNotificationModal";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * T3-3: 링크 생성/배포 페이지
 * 거래처별 주문 전용 URL을 관리하고 복사할 수 있는 페이지
 * URL 포맷: ${window.location.origin}/order/${client.slug}
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

import { getStorefrontUrl } from "@/lib/app-url";

/** 테이블 셀: 연관 요소만 타이트하게 그룹 (셀 전체를 채우지 않음) */
const ORDER_LINK_CHIP_CLASS =
  "inline-flex h-9 w-[200px] max-w-[200px] shrink-0 items-center overflow-hidden rounded-md border border-slate-200/90 bg-slate-100 px-2.5";
const ORDER_LINK_ACTION_BTN =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800";
const CALLLINK_PRIMARY_BTN =
  "inline-flex h-9 w-[180px] min-w-[180px] max-w-[180px] shrink-0 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors";
const CALLLINK_COMPLETE_BTN =
  "inline-flex h-9 w-max shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 text-xs font-medium transition-colors";
const CALLLINK_GEAR_BTN =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800";

export default function ClientsLinksPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerSubdomain, setPartnerSubdomain] = useState<string>("");
  const [partnerName, setPartnerName] = useState<string>("");
  const [partnerContact, setPartnerContact] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [is070ModalOpen, setIs070ModalOpen] = useState(false);
  const [callcloudModalEntry, setCallcloudModalEntry] = useState<CallcloudModalEntry>("connect");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkModalClient, setLinkModalClient] = useState<Client | null>(null);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchPartner() {
      const res = await adminFetch("/api/partner");
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) {
          setPartnerId(result.data.id);
          setPartnerSubdomain(result.data.subdomain ?? "");
          setPartnerName(result.data.company_name ?? "");
          setPartnerContact(result.data.contact ?? "");
        } else setPartnerId(null);
      }
    }
    fetchPartner();
  }, []);

  const fetchClients = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/clients?partnerId=${partnerId}`);
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

  // 검색 필터링 (거래처명 또는 담당자명)
  const filteredClients = clients.filter((c) => {
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.contact_name || "").toLowerCase().includes(query)
    );
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

  // 주문 링크 생성 (올바른 형식: [subdomain].도메인/[clientSlug])
  const getOrderLink = (slug: string) => getStorefrontUrl(partnerSubdomain, slug);

  // 주문 링크 표시용 (짧은 버전)
  const getOrderLinkDisplay = (slug: string) => {
    return `/${partnerSubdomain}/${slug}`;
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

  // 클립보드 복사
  const copyToClipboard = async (clientId: string, slug: string) => {
    const url = getOrderLink(slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(clientId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert("복사에 실패했습니다.");
    }
  };

  // 새 탭에서 열기
  const openInNewTab = (slug: string) => {
    const url = getOrderLink(slug);
    window.open(url, "_blank");
  };

  const openCallcloudModal = (client: Client, entry: CallcloudModalEntry) => {
    setSelectedClient(client);
    setCallcloudModalEntry(entry);
    setIs070ModalOpen(true);
  };

  // 거래처 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까? 연결된 사용자 매핑도 함께 삭제됩니다.")) return;
    const res = await adminFetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) fetchClients();
    else {
      const data = await res.json();
      alert(data.error || "삭제 실패");
    }
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

      {is070ModalOpen && selectedClient && (
        <CallcloudIntegrationModal
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          serviceUrl={getStorefrontUrl(partnerSubdomain, selectedClient.slug)}
          contactName={selectedClient.contact_name ?? ""}
          contactPhone={selectedClient.contact_phone ?? ""}
          contactEmail={selectedClient.contact_email ?? ""}
          isOpen={is070ModalOpen}
          entry={callcloudModalEntry}
          onClose={() => {
            setIs070ModalOpen(false);
            setSelectedClient(null);
          }}
          onSuccess={fetchClients}
        />
      )}

      {isLinkModalOpen && linkModalClient && partnerId && (
        <LinkNotificationModal
          isOpen={isLinkModalOpen}
          onClose={() => {
            setIsLinkModalOpen(false);
            setLinkModalClient(null);
          }}
          partnerId={partnerId}
          partnerName={partnerName}
          partnerSubdomain={partnerSubdomain}
          partnerContact={partnerContact}
          clientId={linkModalClient.id}
          clientSlug={linkModalClient.slug}
          assigned070Number={
            linkModalClient.call_070_connected &&
            linkModalClient.client_call_070_configs?.[0]?.call_070_number
              ? format070Display(linkModalClient.client_call_070_configs[0].call_070_number)
              : ""
          }
          recipientPhone={linkModalClient.contact_phone ?? ""}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-50 px-4 py-4 sm:p-6 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
        {/* 헤더: 재고 관리와 동일한 여백 */}
        <AdminPageHeader
          className="shrink-0"
          eyebrow="Clients · Links"
          title="거래처/링크 관리"
          titleIcon={Link2}
          description={
            <span className="break-keep [word-break:keep-all]">
              거래처를 검색과 필터로 빠르게 찾고, 주문 전용 Link 생성 및 CallLink(070번호) 연동을 통합 관리합니다.
            </span>
          }
        />

        {/* 검색 필터: 재고 관리 필터와 동일한 mb-4, gap 정렬 */}
        <div className="shrink-0 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm [@media(min-width:768px)_and_(max-height:860px)]:mb-3 [@media(min-width:768px)_and_(max-height:860px)]:gap-2 [@media(min-width:768px)_and_(max-height:860px)]:p-3">
          <form onSubmit={handleSearch} className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="거래처명 또는 담당자 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
              />
            </div>
            <button
              type="submit"
              className="h-10 rounded-md px-4 text-sm font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: "#1e293b" }}
            >
              조회
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setEditingClient(null);
              setRegistrationModalOpen(true);
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90"
            style={{ backgroundColor: "#1e293b" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            거래처 등록
          </button>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}

        {/* 테이블: 최소 높이 · 모바일 카드 */}
        <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="scrollbar-thin flex-1 overflow-y-auto pb-4 md:hidden">
            <div className="space-y-3 p-3">
              {loading ? (
                <p className="py-12 text-center text-sm text-slate-500">불러오는 중…</p>
              ) : displayedClients.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">등록된 거래처가 없습니다.</p>
              ) : (
                displayedClients.map((c, idx) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
                  >
                    <p className="text-xs text-slate-500">
                      #{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-800">{c.name}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      담당 {c.contact_name || "-"} · {c.contact_phone || "-"}
                    </p>
                    <p className="mt-2 truncate font-mono text-xs text-slate-700" title={getOrderLinkDisplay(c.slug)}>
                      {getOrderLinkDisplay(c.slug)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(c.id, c.slug)}
                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        {copiedId === c.id ? "복사됨" : "링크 복사"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openInNewTab(c.slug)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        열기
                      </button>
                      <button
                        type="button"
                        onClick={() => openCallcloudModal(c, "connect")}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        070 연동
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkModalClient(c);
                          setIsLinkModalOpen(true);
                        }}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                      >
                        Link 안내
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="scrollbar-thin hidden min-h-0 flex-1 overflow-y-auto pb-4 md:flex md:flex-col">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_#e2e8f0]">
                <tr>
                  <th className="w-12 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    거래처명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    담당자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    연락처
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    주문링크
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">
                    CallLink 연동
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    고객사 Link 안내
                  </th>
                  <th className="w-28 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                      불러오는 중…
                    </td>
                  </tr>
                ) : displayedClients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">
                      등록된 거래처가 없습니다.
                    </td>
                  </tr>
                ) : (
                  displayedClients.map((c, idx) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 text-sm transition-colors hover:bg-slate-50/50"
                    >
                      {/* No */}
                      <td className="px-4 py-3 text-center text-sm text-slate-500">
                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </td>

                      {/* 거래처명 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </span>
                          <span className="font-bold text-slate-800">{c.name}</span>
                        </div>
                      </td>

                      {/* 담당자 */}
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {c.contact_name || "-"}
                      </td>

                      {/* 연락처 */}
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {c.contact_phone || "-"}
                      </td>

                      {/* 주문링크 — 좌측 정렬, 칩+아이콘 찰싹 그룹 (w-full·justify-between 없음) */}
                      <td className="px-4 py-3 align-middle">
                        <div className="inline-flex items-center justify-start gap-2">
                          <span
                            className={ORDER_LINK_CHIP_CLASS}
                            title={getOrderLinkDisplay(c.slug)}
                          >
                            <span className="min-w-0 flex-1 truncate font-mono text-xs leading-none text-slate-700">
                              {getOrderLinkDisplay(c.slug)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(c.id, c.slug)}
                            className={ORDER_LINK_ACTION_BTN}
                            title="링크 복사"
                          >
                            {copiedId === c.id ? (
                              <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => openInNewTab(c.slug)}
                            className={ORDER_LINK_ACTION_BTN}
                            title="새 탭에서 열기"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                      </td>

                      {/* CallLink — 좌측 기준선 정렬 */}
                      <td className="px-4 py-3 align-middle">
                        {(() => {
                          const call070Number =
                            c.client_call_070_configs?.[0]?.call_070_number?.trim() || null;
                          const is070Live = c.call_070_connected === true;
                          if (!call070Number) {
                            return (
                              <div className="flex justify-start">
                                <div className="inline-flex items-center justify-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openCallcloudModal(c, "connect")}
                                    className={`${CALLLINK_PRIMARY_BTN} border-slate-200/90 bg-slate-50 text-slate-700 hover:bg-slate-100/90`}
                                  >
                                    <LinkIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                                    <span className="truncate">Callcloud 연동하기</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openCallcloudModal(c, "connect")}
                                    className={CALLLINK_GEAR_BTN}
                                    title="연동 설정"
                                  >
                                    <Settings className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          if (!is070Live) {
                            return (
                              <div className="flex justify-start">
                                <div className="inline-flex items-center justify-start gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openCallcloudModal(c, "pending")}
                                    className={`${CALLLINK_PRIMARY_BTN} border-amber-200/90 bg-amber-50/95 text-amber-950 hover:bg-amber-100/90`}
                                    title="Callcloud에 등록된 뒤 시트에서 진행상태를 완료로 바꾸면 070 번호가 표시됩니다."
                                  >
                                    <Link2
                                      className="h-3.5 w-3.5 shrink-0 text-amber-600 animate-pulse"
                                      strokeWidth={2}
                                      aria-hidden
                                    />
                                    <span className="truncate">Callcloud 연동 중</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openCallcloudModal(c, "pending")}
                                    className={CALLLINK_GEAR_BTN}
                                    title="연동 설정·요청"
                                  >
                                    <Settings className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="flex justify-start">
                              <div className="inline-flex items-center justify-start gap-2">
                                <button
                                  type="button"
                                  onClick={() => openCallcloudModal(c, "connect")}
                                  className={`${CALLLINK_COMPLETE_BTN} border-emerald-200/85 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100/90`}
                                >
                                  <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-700" strokeWidth={2} />
                                  <span className="shrink-0 tabular-nums tracking-tight">
                                    {format070Display(call070Number)}
                                  </span>
                                  <Badge
                                    variant="active"
                                    className="shrink-0 px-1 py-0 text-[9px] font-medium leading-tight"
                                  >
                                    연동 완료
                                  </Badge>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openCallcloudModal(c, "connect")}
                                  className={CALLLINK_GEAR_BTN}
                                  title="연동 수정"
                                >
                                  <Settings className="h-4 w-4" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 고객사 Link 안내 (헤더) / Link 안내 발송 (버튼) */}
                      <td className="px-4 py-3 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => {
                            setLinkModalClient(c);
                            setIsLinkModalOpen(true);
                          }}
                          className="inline-flex h-9 min-w-[8.5rem] items-center justify-center gap-1.5 rounded-md border border-slate-200/90 bg-slate-50 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/90"
                        >
                          <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                          Link 안내 발송
                        </button>
                      </td>

                      {/* 관리 */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* 수정 버튼 */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClient(c);
                              setRegistrationModalOpen(true);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            title="수정"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* 삭제 버튼 */}
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-600"
                            title="삭제"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이징: 재고 관리와 동일하게 테이블 카드 하단에 통합 */}
          {!loading && filteredClients.length > 0 && (
            <div className="flex shrink-0 flex-col items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <div className="relative h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200">
                <div
                  className="absolute top-0 h-full rounded-full bg-slate-600 transition-all duration-200"
                  style={{
                    width: `${100 / clientTotalPages}%`,
                    left: `${((currentPage - 1) / clientTotalPages) * 100}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-center gap-2">
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
            </div>
          )}
        </div>

        {/* 하단 안내: [복사] 버튼 설명 */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="mt-0.5 text-blue-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <p className="text-sm text-blue-700">
            <span className="font-medium">[복사]</span> 버튼을 클릭하면 해당 거래처의 전용 주문 링크가 클립보드에 복사됩니다.
          </p>
        </div>
      </div>
    </>
  );
}
