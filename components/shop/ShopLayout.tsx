"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu, Search, ShoppingBag } from "lucide-react";
import { ShopTemplateProvider, useShopTemplate } from "./ShopTemplateContext";
import { ToastProvider, toast } from "./ToastContext";
import { SideMenu } from "./SideMenu";
import { ProductSearchModal } from "./ProductSearchModal";
import { isShopPaymentTunnelPath } from "@/lib/shop-payment-tunnel";

function MasterTemplateIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  );
}

/**
 * 마스터 쇼핑몰 템플릿 (Design System: Snowfox Flowers)
 * Primary: #D6A8E0, Mobile-first max-w-[430px], sticky header/footer z-50
 */

/** 글로벌 헤더 높이(px). 메인 safe area pt 및 CTA bottom 계산에 사용 */
export const HEADER_HEIGHT = 56;
/** 글로벌 하단 네비 높이(px). 메인 safe area pb 및 고정 CTA가 네비 위에 오도록 bottom 계산 */
export const BOTTOM_NAV_HEIGHT = 64;
export interface ShopPartner {
  id: string;
  subdomain: string;
  company_name: string;
}

export interface ShopClient {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  partner_id: string;
}

export interface ShopLayoutProps {
  orderAllowed: boolean;
  subdomain: string;
  clientSlug: string | null;
  partner: ShopPartner;
  client: ShopClient | null;
  children: React.ReactNode;
}

const PRIMARY = "#D6A8E0";

/** 마스터 템플릿 미리보기용 가상 거래처 slug. 이 경로로 진입 시 주문/결제만 차단하고 모든 화면 열람 허용 */
export const PREVIEW_SLUG = "_preview";

/** 메인 홈: ShopMainHome 사업자 푸터가 하단 네비 여백 포함 — main에 중복 pb 방지 */
function mainScrollPaddingBottom(
  pathname: string,
  subdomain: string,
  clientSlug: string | null
) {
  if (isShopPaymentTunnelPath(pathname)) return 0;
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const homes = new Set<string>([
    `/${subdomain}`,
    `/${subdomain}/${PREVIEW_SLUG}`,
  ]);
  if (clientSlug) {
    homes.add(`/${subdomain}/${clientSlug}`);
  }
  return homes.has(normalized) ? 0 : BOTTOM_NAV_HEIGHT;
}

/**
 * 글로벌 상단 헤더 (B2B2C 브랜딩: 중앙 CI 고정 + 좌측 아이콘 스왑)
 * 좌: 루트=햄버거 / 서브=뒤로가기 | 중앙: 거래처 CI + 거래처명 | 우: 검색 + 장바구니(뱃지)
 */
function SmartHeader({
  partner,
  client,
  subdomain,
  clientSlug,
  orderAllowed,
  onMenuClick,
  onSearchClick,
}: {
  partner: ShopPartner | null;
  client: ShopClient | null;
  subdomain: string;
  clientSlug: string | null;
  orderAllowed: boolean;
  onMenuClick: () => void;
  onSearchClick?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}/${PREVIEW_SLUG}`;

  const homeHref = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}`;
  const cartHref = base + "/cart";
  const ensureOrderAllowed = useShopTemplate()?.ensureOrderAllowed;
  const { status: sessionStatus } = useSession();
  const [cartCount, setCartCount] = useState(0);
  const [logoLoadError, setLogoLoadError] = useState(false);

  const refreshCartCount = useCallback(() => {
    if (!client?.id) return;
    const useGuestCart =
      pathname.includes("/guest-order") ||
      (pathname.includes("/checkout") && searchParams.get("guest") === "1");
    const itemsParam = searchParams.get("items")?.trim();
    const onlyIdsPart =
      itemsParam && itemsParam.length > 0 ? `&onlyIds=${encodeURIComponent(itemsParam)}` : "";
    const url = `/api/cart?clientId=${encodeURIComponent(client.id)}&countOnly=1${useGuestCart ? "&guestCart=1" : ""}${onlyIdsPart}`;
    fetch(url, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data) => {
        const count = data?.count ?? data?.items?.length ?? 0;
        setCartCount(count);
      })
      .catch(() => setCartCount(0));
  }, [client?.id, pathname, searchParams]);

  // 로그인/로그아웃 전환 시 회원 장바구니 ↔ 게스트 장바구니 기준이 바뀌므로 즉시 재조회
  useEffect(() => {
    refreshCartCount();
  }, [refreshCartCount, sessionStatus]);

  useEffect(() => {
    const onCartUpdated = () => refreshCartCount();
    window.addEventListener("cart-updated", onCartUpdated);
    return () => window.removeEventListener("cart-updated", onCartUpdated);
  }, [refreshCartCount]);

  // 탭 포커스 시 뱃지 재조회 (초기 로드 시 세션 지연으로 401 나온 경우 보완)
  useEffect(() => {
    const onFocus = () => refreshCartCount();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshCartCount]);

  // 거래처 변경 시 로고 에러 상태 초기화 (멀티테넌트 전환 대응)
  useEffect(() => {
    setLogoLoadError(false);
  }, [client?.id, client?.logo_url]);

  const handleCartClick = () => {
    // 미리보기 모드에서도 장바구니 페이지 진입 허용 (주문하기 버튼에서만 차단)
  };

  const isMasterPreview = !client;
  const displayName = client?.name ?? partner?.company_name ?? "쇼핑몰";
  const showLogoImg = client?.logo_url && !logoLoadError;
  const logoContent = isMasterPreview ? (
    <span className="flex items-center gap-1.5">
      <MasterTemplateIcon className="h-5 w-5 shrink-0 opacity-90" />
      <span className="text-sm font-bold tracking-wider text-[#333333]">MASTER</span>
      <span className="text-sm font-medium tracking-wide text-gray-500">TEMPLATE</span>
    </span>
  ) : showLogoImg ? (
    <img
      src={client!.logo_url!}
      alt={client!.name}
      className="h-6 max-w-[120px] object-contain"
      onError={() => setLogoLoadError(true)}
    />
  ) : (
    <span className="text-base font-semibold tracking-tight text-[#333333]">
      {displayName}
    </span>
  );

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 border-b border-gray-200 bg-white"
      style={{ height: HEADER_HEIGHT }}
    >
      <div className="relative mx-auto flex h-full max-w-[430px] items-center justify-between px-4">
        {/* 좌측: 항상 햄버거 메뉴 (w-16로 우측 영역과 폭 통일, -ml-2로 좌측 밀착) */}
        <div className="-ml-2 flex h-10 w-16 shrink-0 items-center justify-start">
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 min-w-10 items-center justify-center rounded-md py-2 pl-0 pr-2 text-[#333333] hover:bg-[#F3F4F6]"
            aria-label="메뉴"
          >
            <Menu strokeWidth={1.5} className="h-6 w-6 shrink-0" />
          </button>
        </div>
        <Link
          href={homeHref}
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5"
        >
          {logoContent}
          {!isMasterPreview && (
            <span className="text-[12px] text-gray-600">{displayName}</span>
          )}
        </Link>
        {/* 우측: 검색 + 장바구니 (좌측과 동일한 w-16 폭으로 중앙 CI 정렬 유지) */}
        <div className="flex h-10 w-16 shrink-0 items-center justify-end gap-1">
          <button
            type="button"
            onClick={onSearchClick}
            className="flex h-10 w-10 items-center justify-center rounded-md text-[#333333] hover:bg-[#F3F4F6]"
            aria-label="검색"
          >
            <Search strokeWidth={1.5} className="h-5 w-5" />
          </button>
          <Link
            href={cartHref}
            onClick={handleCartClick}
            className="relative flex h-10 w-10 items-center justify-center rounded-md text-[#333333] hover:bg-[#F3F4F6]"
            aria-label="장바구니"
          >
            <ShoppingBag strokeWidth={1.5} className="h-5 w-5" />
            {cartCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** 레거시: ShopLayout에서만 사용 (SmartHeader와 동일 단일 레이아웃) */
function ShopHeader({
  partner,
  client,
  subdomain,
  clientSlug,
  orderAllowed,
  onMenuClick,
  onSearchClick,
}: {
  partner: ShopPartner;
  client: ShopClient | null;
  subdomain: string;
  clientSlug: string | null;
  orderAllowed: boolean;
  onMenuClick: () => void;
  onSearchClick?: () => void;
}) {
  return (
    <SmartHeader
      partner={partner}
      client={client}
      subdomain={subdomain}
      clientSlug={clientSlug}
      orderAllowed={orderAllowed}
      onMenuClick={onMenuClick}
      onSearchClick={onSearchClick}
    />
  );
}

function ShopBottomNav({
  subdomain,
  clientSlug,
  orderAllowed,
}: {
  subdomain: string;
  clientSlug: string | null;
  orderAllowed: boolean;
}) {
  const pathname = usePathname();
  if (isShopPaymentTunnelPath(pathname)) return null;

  const base = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}/${PREVIEW_SLUG}`;

  const navItems = [
    { label: "홈", path: "", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { label: "카테고리", path: "/products", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" },
    { label: "최근 본 상품", path: "/recent", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "마이페이지", path: "/mypage", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 w-full border-t border-gray-100 bg-white"
      style={{ height: BOTTOM_NAV_HEIGHT }}
    >
      <div className="mx-auto flex h-full max-w-[430px] justify-around py-2">
        {navItems.map((item) => {
          const href = `${base}${item.path}`;
          const exactPath = `${base}${item.path}`;
          const isActive =
            pathname === exactPath ||
            (item.path === "" && (pathname === base || pathname === base + "/")) ||
            (item.path === "/mypage" && (pathname === exactPath || pathname.startsWith(exactPath + "/")));
          return (
            <Link
              key={item.path || "home"}
              href={href}
              className="flex flex-col items-center gap-0.5 py-1 text-xs font-medium"
            >
              <svg
                className="h-6 w-6"
                style={{ color: isActive ? PRIMARY : "#9CA3AF" }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span
                className={isActive ? "font-semibold" : "font-medium"}
                style={{ color: isActive ? PRIMARY : "#9CA3AF" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function ShopLayout({
  orderAllowed,
  subdomain,
  clientSlug,
  partner,
  client,
  children,
}: ShopLayoutProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const ensureOrderAllowed = useCallback(() => {
    if (orderAllowed) return true;
    toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
    return false;
  }, [orderAllowed]);

  const contextValue = {
    orderAllowed,
    subdomain,
    clientSlug,
    ensureOrderAllowed,
    partner: partner ?? undefined,
    client: client ?? undefined,
  };

  useEffect(() => {
    if (typeof document === "undefined" || !subdomain) return;
    const maxAge = 60 * 60 * 24 * 180;
    document.cookie = `last_partner_subdomain=${encodeURIComponent(subdomain)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    if (clientSlug && clientSlug !== "_preview") {
      document.cookie = `last_shop_client_slug=${encodeURIComponent(clientSlug)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  }, [subdomain, clientSlug]);

  return (
    <ShopTemplateProvider value={contextValue}>
      <ToastProvider>
      <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
        <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-1 flex-col overflow-hidden bg-white shadow-2xl">
          <SideMenu
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            subdomain={subdomain}
            clientSlug={clientSlug}
            partner={partner}
            client={client}
            orderAllowed={orderAllowed}
            onSearchClick={() => setSearchOpen(true)}
          />
          <ShopHeader
            partner={partner}
            client={client}
            subdomain={subdomain}
            clientSlug={clientSlug}
            orderAllowed={orderAllowed}
            onMenuClick={() => setMenuOpen(true)}
            onSearchClick={() => setSearchOpen(true)}
          />
          <ProductSearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            subdomain={subdomain}
            clientSlug={clientSlug}
          />
          <main
            className="flex-1 overflow-auto"
            style={{
              paddingTop: HEADER_HEIGHT,
              paddingBottom: mainScrollPaddingBottom(
                pathname,
                subdomain,
                clientSlug
              ),
            }}
          >
            {children}
          </main>
          <ShopBottomNav
            subdomain={subdomain}
            clientSlug={clientSlug}
            orderAllowed={orderAllowed}
          />
        </div>
      </div>
      </ToastProvider>
    </ShopTemplateProvider>
  );
}

/** 글로벌 하단 네비 (SmartHeader와 함께 사용). fixed bottom-0, 높이 BOTTOM_NAV_HEIGHT */
export const GlobalBottomNav = ShopBottomNav;

export interface ShopGlobalLayoutProps {
  subdomain: string;
  clientSlug: string | null;
  partner: ShopPartner | null;
  client: ShopClient | null;
  children: React.ReactNode;
}

/**
 * 글로벌 고정 레이아웃: SmartHeader + 메인(safe area) + GlobalBottomNav.
 * [subdomain]/[clientSlug]/layout.tsx에서 사용. partner/client는 서버에서 fetch 후 전달.
 */
export function ShopGlobalLayout({
  subdomain,
  clientSlug,
  partner,
  client,
  children,
}: ShopGlobalLayoutProps) {
  const orderAllowed = !!client;
  const pathname = usePathname();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const ensureOrderAllowed = useCallback(() => {
    if (orderAllowed) return true;
    toast("마스터 템플릿 미리보기 상태에서는 주문 및 장바구니 담기가 불가능합니다.");
    return false;
  }, [orderAllowed]);

  const contextValue = {
    orderAllowed,
    subdomain,
    clientSlug,
    ensureOrderAllowed,
    partner: partner ?? undefined,
    client: client ?? undefined,
  };

  return (
    <ShopTemplateProvider value={contextValue}>
      <ToastProvider>
      <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
        <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-1 flex-col overflow-hidden bg-white shadow-2xl">
          {partner && (
            <SideMenu
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              subdomain={subdomain}
              clientSlug={clientSlug}
              partner={partner}
              client={client}
              orderAllowed={orderAllowed}
              onSearchClick={() => setSearchOpen(true)}
            />
          )}
          <SmartHeader
            partner={partner}
            client={client}
            subdomain={subdomain}
            clientSlug={clientSlug}
            orderAllowed={orderAllowed}
            onMenuClick={() => setMenuOpen(true)}
            onSearchClick={() => setSearchOpen(true)}
          />
          <ProductSearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            subdomain={subdomain}
            clientSlug={clientSlug}
          />
          <main
            className="flex-1 overflow-auto"
            style={{
              paddingTop: HEADER_HEIGHT,
              paddingBottom: mainScrollPaddingBottom(
                pathname,
                subdomain,
                clientSlug
              ),
            }}
          >
            {children}
          </main>
          <ShopBottomNav
            subdomain={subdomain}
            clientSlug={clientSlug}
            orderAllowed={orderAllowed}
          />
        </div>
      </div>
      </ToastProvider>
    </ShopTemplateProvider>
  );
}
