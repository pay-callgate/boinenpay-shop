"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Link as LinkIcon, Phone, Settings } from "lucide-react";
import { ClientRegistrationModal } from "@/components/admin/ClientRegistrationModal";
import { Call070Modal } from "@/components/admin/Call070Modal";

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

import { getBaseUrl, getStorefrontUrl } from "@/lib/app-url";
const BASE_URL = getBaseUrl();

export default function ClientsLinksPage() {
  const params = useParams();
  const subdomain = params?.subdomain as string;

  const [clients, setClients] = useState<Client[]>([]);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [is070ModalOpen, setIs070ModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function fetchPartner() {
      const res = await fetch(`/api/partner?subdomain=${subdomain}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data?.id) setPartnerId(result.data.id);
        else setPartnerId(null);
      }
    }
    if (subdomain) fetchPartner();
  }, [subdomain]);

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

  // 주문 링크 생성 (올바른 형식: /{subdomain}/{clientSlug})
  const getOrderLink = (slug: string) => getStorefrontUrl(subdomain, slug);

  // 주문 링크 표시용 (짧은 버전)
  const getOrderLinkDisplay = (slug: string) => {
    return `/${subdomain}/${slug}`;
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

  // 거래처 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까? 연결된 사용자 매핑도 함께 삭제됩니다.")) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
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
        subdomain={subdomain}
        initialData={editingClient}
        onSuccess={fetchClients}
      />

      {is070ModalOpen && selectedClient && (
        <Call070Modal
          clientId={selectedClient.id}
          clientName={selectedClient.name}
          serviceUrl={getStorefrontUrl(subdomain, selectedClient.slug)}
          isOpen={is070ModalOpen}
          onClose={() => {
            setIs070ModalOpen(false);
            setSelectedClient(null);
          }}
          onSuccess={fetchClients}
        />
      )}

      <div className="min-h-screen bg-slate-50 p-6">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">거래처/링크 관리</h1>
          <p className="mt-1 text-sm text-slate-600">
            거래처 정보 관리, 주문 전용 Link 생성 및 CallLink(070번호) 연동을 통합 관리합니다.
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            총 {filteredClients.length}개 거래처
          </p>
        </div>

        {/* 검색 필터 박스 */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
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
                className="h-10 rounded-md border border-slate-300 bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-900"
              >
                조회
              </button>
            </div>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => {
                  setEditingClient(null);
                  setRegistrationModalOpen(true);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                거래처 등록
              </button>
            </div>
          </form>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}

        {/* 테이블 */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
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
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    CallLink 연동
                  </th>
                  <th className="w-28 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      로딩 중...
                    </td>
                  </tr>
                ) : displayedClients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      등록된 거래처가 없습니다.
                    </td>
                  </tr>
                ) : (
                  displayedClients.map((c, idx) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50/50"
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

                      {/* 주문링크 */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded bg-slate-100 px-3 py-1.5 font-mono text-sm text-slate-700">
                            {getOrderLinkDisplay(c.slug)}
                          </span>
                          {/* 복사 버튼 */}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(c.id, c.slug)}
                            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
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
                          {/* 외부 링크 버튼 */}
                          <button
                            type="button"
                            onClick={() => openInNewTab(c.slug)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            title="새 탭에서 열기"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </div>
                      </td>

                      {/* CallLink 연동 */}
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const call070Number =
                            c.client_call_070_configs?.[0]?.call_070_number?.trim() || null;
                          if (!call070Number) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClient(c);
                                  setIs070ModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <LinkIcon className="h-4 w-4 text-slate-500" />
                                CallLink 연동하기
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
                                onClick={() => {
                                  setSelectedClient(c);
                                  setIs070ModalOpen(true);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                title="연동 수정"
                              >
                                <Settings className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          );
                        })()}
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
        </div>

        {/* 하단 안내 박스: 복사 안내 + 검증용 테스트 링크 */}
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <span className="mt-0.5 text-blue-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <p className="text-sm text-blue-700">
              <span className="font-medium">[복사]</span> 버튼을 클릭하면 해당 거래처의 전용 주문 링크가 클립보드에 복사됩니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              검증용 테스트 링크
            </p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              <li>
                <span className="font-medium text-slate-800">① 파트너 메인 (마스터 템플릿, 주문 불가)</span>
                <br />
                <a
                  href={`${BASE_URL}/${subdomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-0.5 break-all text-purple-600 underline hover:text-purple-700"
                >
                  {BASE_URL}/{subdomain}
                </a>
                <br />
                <span className="text-xs text-slate-500">상품 브라우징만 가능. 주문·장바구니·마이페이지 클릭 시 안내 Alert.</span>
              </li>
              <li className="pt-1">
                <span className="font-medium text-slate-800">② 거래처 전용 쇼핑몰 (주문 가능)</span>
                <br />
                <span className="text-xs text-slate-500">위 테이블의 [복사] 또는 [외부링크]로 각 거래처 URL 확인. 예: 기아자동차(knauto)</span>
                <br />
                <a
                  href={`${BASE_URL}/${subdomain}/knauto`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-0.5 break-all text-purple-600 underline hover:text-purple-700"
                >
                  {BASE_URL}/{subdomain}/knauto
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* 페이징: 스크롤 라인 + 컨트롤 버튼 */}
        {!loading && filteredClients.length > 0 && (
          <div className="mt-6">
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="absolute top-0 h-full rounded-full bg-slate-600 transition-all duration-200"
                style={{
                  width: `${100 / clientTotalPages}%`,
                  left: `${((currentPage - 1) / clientTotalPages) * 100}%`,
                }}
              />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
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
    </>
  );
}
