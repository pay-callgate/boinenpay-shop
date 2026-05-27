/** @see components/shop/ShopLayout PREVIEW_SLUG */
const PREVIEW_SLUG = "_preview";

/** ShopLayout / ShopGlobalLayout 메인 스크롤 컨테이너 (JSX: data-shop-main-scroll) */
export const SHOP_MAIN_SCROLL_SELECTOR = "[data-shop-main-scroll]";

export function normalizeShopPathname(pathname: string): string {
  if (!pathname) return "/";
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

/** 거래처 쇼핑몰 홈 URL (헤더 로고·하단 홈 탭과 동일) */
export function getShopHomeHref(subdomain: string, clientSlug: string | null): string {
  return clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}`;
}

/** 현재 경로가 홈(메인)인지 — 동일 URL 재클릭 시 스크롤 최상단용 */
export function isShopHomePath(
  pathname: string,
  subdomain: string,
  clientSlug: string | null
): boolean {
  const normalized = normalizeShopPathname(pathname);
  const homes = new Set<string>([`/${subdomain}`, `/${subdomain}/${PREVIEW_SLUG}`]);
  if (clientSlug) {
    homes.add(`/${subdomain}/${clientSlug}`);
  }
  return homes.has(normalized);
}

/** fixed 헤더 아래 `<main>` 스크롤을 최상단으로 */
export function scrollShopMainToTop(): void {
  if (typeof document === "undefined") return;
  const main = document.querySelector<HTMLElement>(SHOP_MAIN_SCROLL_SELECTOR);
  if (main) {
    main.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export type ShopHomeLogoClickOptions = {
  pathname: string;
  subdomain: string;
  clientSlug: string | null;
  onAfterNavigate?: () => void;
};

/** 헤더/드로어 로고 Link onClick — 홈 재진입 시 네비게이션 대신 메인 스크롤 */
export function handleShopHomeLogoClick(
  event: { preventDefault: () => void },
  options: ShopHomeLogoClickOptions
): void {
  const { pathname, subdomain, clientSlug, onAfterNavigate } = options;
  if (isShopHomePath(pathname, subdomain, clientSlug)) {
    event.preventDefault();
    scrollShopMainToTop();
  }
  onAfterNavigate?.();
}
