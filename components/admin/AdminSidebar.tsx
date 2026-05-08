"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, Package, Building2, ClipboardList, BarChart3, MessageSquare, User } from "lucide-react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/components/shop/ToastContext";

const BRAND_BLUE = "#2B78C5"; // 로그인 화면 신뢰감 파란색

/**
 * T1-4: 파트너 어드민 사이드바 (B2B SaaS 스타일)
 * 다크 네이비 배경, 브랜드 블루 액센트, 세련된 아코디언, 넉넉한 패딩
 */
/** 중앙 집중형: base=/admin, 상단 표시명은 partnerDisplayName(company_name 또는 subdomain) */
export function AdminSidebar({
  partnerDisplayName,
  userName,
}: {
  partnerDisplayName: string;
  userName?: string | null;
}) {
  const base = "/admin";
  const pathname = usePathname();
  const { toast } = useToast();
  const [unreadOrderNotify, setUnreadOrderNotify] = useState<number | null>(null);
  const partnerIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function ensurePartner(): Promise<string | null> {
      if (partnerIdRef.current) return partnerIdRef.current;
      try {
        const res = await adminFetch("/api/partner");
        if (!res.ok) return null;
        const j = await res.json();
        const id = j.success && j.data?.id ? String(j.data.id) : null;
        if (id) partnerIdRef.current = id;
        return id;
      } catch {
        return null;
      }
    }
    async function poll() {
      const pid = await ensurePartner();
      if (!alive || !pid) return;
      try {
        const res = await adminFetch(
          `/api/partner/order-notifications?partnerId=${encodeURIComponent(pid)}`
        );
        if (!res.ok || !alive) return;
        const j = await res.json();
        const n = typeof j.unreadCount === "number" ? j.unreadCount : 0;
        setUnreadOrderNotify((prev) => {
          if (prev !== null && n > prev) {
            toast(`미확인 주문 알림이 ${n - prev}건 늘었습니다.`, "default");
          }
          return n;
        });
      } catch {
        /* adminFetch가 401 시 리다이렉트 */
      }
    }
    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 45000);
    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [toast]);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    products: false,
    clients: false,
    orders: false,
    stats: false,
    board: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 서브메뉴(2차): 정확히 일치할 때만 활성화 (한 개만 파란색 하이라이트)
  const isSubmenuActive = (href: string) => pathname === href;
  // 1차 메뉴 아코디언: 해당 섹션 하위에 활성 서브메뉴가 있을 때만 강조/열림용
  const hasActiveChild = (items: { href: string }[]) => items.some((item) => isSubmenuActive(item.href));

  const navSections: {
    key: string;
    label: string;
    icon: React.ReactNode;
    items: { href: string; label: string }[];
  }[] = [
    {
      key: "products",
      label: "상품 관리",
      icon: <Package className="h-5 w-5 shrink-0" />,
      items: [
        { href: `${base}/products`, label: "상품 관리" },
        { href: `${base}/categories`, label: "카테고리 관리" },
        { href: `${base}/products/inventory`, label: "재고 관리" },
      ],
    },
    {
      key: "clients",
      label: "거래처 관리",
      icon: <Building2 className="h-5 w-5 shrink-0" />,
      items: [
        { href: `${base}/clients/links`, label: "거래처/링크 관리" },
        { href: `${base}/clients/messages`, label: "알림톡 발송 관리" },
      ],
    },
    {
      key: "orders",
      label: "주문 관리",
      icon: <ClipboardList className="h-5 w-5 shrink-0" />,
      items: [
        { href: `${base}/orders`, label: "주문 목록" },
        { href: `${base}/orders/shipping`, label: "배송 관리" },
        { href: `${base}/orders/returns`, label: "취소/반품" },
      ],
    },
    {
      key: "stats",
      label: "통계",
      icon: <BarChart3 className="h-5 w-5 shrink-0" />,
      items: [
        { href: `${base}/stats/sales`, label: "매출 분석" },
        { href: `${base}/stats/clients`, label: "거래처별 분석" },
      ],
    },
    {
      key: "board",
      label: "게시판/리뷰",
      icon: <MessageSquare className="h-5 w-5 shrink-0" />,
      items: [
        { href: `${base}/notices`, label: "공지사항" },
        { href: `${base}/reviews`, label: "리뷰 관리" },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-900">
      {/* 상단 헤더 - 고객사명 + 사용자 정보 */}
      <div className="border-b border-slate-700/80 bg-slate-800/50 px-4 py-5">
        <p className="text-lg font-bold text-white mb-3">{partnerDisplayName}</p>
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: `${BRAND_BLUE}33` }}
          >
            <User className="h-5 w-5" style={{ color: BRAND_BLUE }} />
          </div>
          <p className="text-sm text-slate-300">
            {userName ? `${userName}님` : "관리자님"}
          </p>
        </div>
      </div>

      {/* 메뉴 네비게이션 */}
      <nav className="p-3">
        <ul className="space-y-0.5">
          {/* 대시보드 - 1차 메뉴 스타일 (파란 박스 제거 및 톤 통일) */}
          <li>
            <Link
              href={base}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                pathname === base
                  ? "text-blue-400 bg-slate-800/60" // 2차 메뉴의 예쁜 활성화 톤과 동일하게 맞춤
                  : "text-slate-300 hover:bg-blue-500/15 hover:text-blue-300"
              }`}
              // 문제의 원인이었던 하드코딩된 파란색 style 속성 완전 삭제
            >
              <LayoutDashboard className="h-5 w-5 shrink-0" />
              <span>대시보드</span>
            </Link>
          </li>
          <li>
            <Link
              href={`${base}/dashboard-real`}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                pathname === `${base}/dashboard-real`
                  ? "text-blue-400 bg-slate-800/60"
                  : "text-slate-300 hover:bg-blue-500/15 hover:text-blue-300"
              }`}
            >
              <LayoutDashboard className="h-5 w-5 shrink-0 opacity-80" />
              <span className="truncate">대시보드(실운영)</span>
            </Link>
          </li>

          {/* 아코디언 섹션 */}
          {navSections.map(({ key, label, icon, items }) => {
            const open = openSections[key];
            const sectionHasActive = hasActiveChild(items);
            return (
              <li key={key} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left text-[15px] font-semibold transition-colors ${
                    sectionHasActive
                      ? "text-blue-300"
                      : "text-slate-200 hover:bg-blue-500/15 hover:text-blue-300"
                  }`}
                  style={
                    sectionHasActive && !open
                      ? { backgroundColor: `${BRAND_BLUE}22` }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {icon}
                    <span className="truncate">{label}</span>
                    {key === "orders" && unreadOrderNotify !== null && unreadOrderNotify > 0 ? (
                      <span
                        className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
                        title="미확인 주문 알림"
                      >
                        {unreadOrderNotify > 99 ? "99+" : unreadOrderNotify}
                      </span>
                    ) : null}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      open ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>
                {open && (
                  <ul className="mt-0.5 space-y-0.5 pl-6">
                    {items.map((item) => {
                      const active = isSubmenuActive(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={`flex items-center justify-between gap-2 rounded-lg border-l-2 py-2.5 pl-4 pr-4 text-[14px] font-medium transition-colors ${
                              active
                                ? "text-blue-400 bg-slate-800/60"
                                : "border-transparent text-slate-400 hover:border-slate-600 hover:bg-blue-500/10 hover:text-slate-200"
                            }`}
                            style={
                              active
                                ? { borderLeftColor: BRAND_BLUE }
                                : undefined
                            }
                          >
                            <span>{item.label}</span>
                            {item.href === `${base}/orders` &&
                            unreadOrderNotify !== null &&
                            unreadOrderNotify > 0 ? (
                              <span className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {unreadOrderNotify > 99 ? "99+" : unreadOrderNotify}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
