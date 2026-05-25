"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  Package,
  Building2,
  ClipboardList,
  BarChart3,
  MessageSquare,
  User,
} from "lucide-react";

const BRAND_BLUE = "#2B78C5"; // 로그인 화면 신뢰감 파란색

type AdminSidebarProps = {
  partnerDisplayName: string;
  userName?: string | null;
  /** `useAdminOrderUnreadNotify` — 셸에서 단일 폴링 (온보딩 등 비대시보드 레이아웃에서는 생략 가능) */
  unreadOrderNotify?: number | null;
  /** 모바일 드로어 등에서 링크 클릭 시 닫기 */
  onNavigate?: () => void;
  /** 래퍼 (데스크톱: hidden md:flex 등) */
  className?: string;
  /** 드로어 상단 닫기 버튼 */
  showDrawerClose?: boolean;
  onDrawerClose?: () => void;
};

/**
 * T1-4: 파트너 어드민 사이드바 (B2B SaaS 스타일)
 * 미확인 알림 폴링은 `useAdminOrderUnreadNotify` + 셸 단일 인스턴스.
 */
export function AdminSidebar({
  partnerDisplayName,
  userName,
  unreadOrderNotify = null,
  onNavigate,
  className = "hidden w-64 shrink-0 border-r border-slate-800 bg-slate-900 md:flex md:flex-col",
  showDrawerClose,
  onDrawerClose,
}: AdminSidebarProps) {
  const base = "/admin";
  const pathname = usePathname();

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

  const isSubmenuActive = (href: string) => pathname === href;
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
        { href: `${base}/info-templates`, label: "공통 안내 관리" },
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

  const linkAfterNav = () => {
    onNavigate?.();
  };

  return (
    <aside className={className}>
      {showDrawerClose ? (
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/80 px-3 py-2 md:hidden">
          <span className="text-sm font-semibold text-white">메뉴</span>
          <button
            type="button"
            onClick={onDrawerClose}
            className="rounded-md px-2 py-1 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-white"
            aria-label="메뉴 닫기"
          >
            닫기
          </button>
        </div>
      ) : null}

      <div className="border-b border-slate-700/80 bg-slate-800/50 px-4 py-5">
        <p className="mb-3 text-lg font-bold text-white">{partnerDisplayName}</p>
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

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-0.5">
          <li>
            <Link
              href={base}
              onClick={linkAfterNav}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                pathname === base
                  ? "bg-slate-800/60 text-blue-400"
                  : "text-slate-300 hover:bg-blue-500/15 hover:text-blue-300"
              }`}
            >
              <LayoutDashboard className="h-5 w-5 shrink-0" />
              <span>대시보드</span>
            </Link>
          </li>
          <li>
            <Link
              href={`${base}/dashboard-real`}
              onClick={linkAfterNav}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                pathname === `${base}/dashboard-real`
                  ? "bg-slate-800/60 text-blue-400"
                  : "text-slate-300 hover:bg-blue-500/15 hover:text-blue-300"
              }`}
            >
              <LayoutDashboard className="h-5 w-5 shrink-0 opacity-80" />
              <span className="truncate">대시보드(실운영)</span>
            </Link>
          </li>

          {navSections.map(({ key, label, icon, items }) => {
            const sectionHasActive = hasActiveChild(items);
            const expanded = sectionHasActive ? true : openSections[key];
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
                    sectionHasActive && !expanded
                      ? { backgroundColor: `${BRAND_BLUE}22` }
                      : undefined
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {icon}
                    <span className="truncate">{label}</span>
                    {key === "orders" && unreadOrderNotify !== null && unreadOrderNotify > 0 ? (
                      <span
                        className="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
                        title="미확인 결제 완료 알림(주문 건수)"
                      >
                        {unreadOrderNotify > 99 ? "99+" : unreadOrderNotify}
                      </span>
                    ) : null}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                      expanded ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>
                {expanded && (
                  <ul className="mt-0.5 space-y-0.5 pl-6">
                    {items.map((item) => {
                      const active = isSubmenuActive(item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={linkAfterNav}
                            className={`flex items-center justify-between gap-2 rounded-lg border-l-2 py-2.5 pl-4 pr-4 text-[14px] font-medium transition-colors ${
                              active
                                ? "bg-slate-800/60 text-blue-400"
                                : "border-transparent text-slate-400 hover:border-slate-600 hover:bg-blue-500/10 hover:text-slate-200"
                            }`}
                            style={active ? { borderLeftColor: BRAND_BLUE } : undefined}
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
