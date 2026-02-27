/**
 * 최근 본 상품 localStorage (키: recent_products)
 * 최대 20개, 중복 시 최상단으로 이동
 */

const STORAGE_KEY = "recent_products";
const MAX_ITEMS = 20;

export interface RecentProductItem {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  base_price: number;
  sale_price: number | null;
  status: string;
  subdomain: string;
  clientSlug: string;
  viewed_at: string;
}

function loadAll(): RecentProductItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: RecentProductItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

/** 현재 쇼핑몰(subdomain + clientSlug) 기준 최근 본 상품 목록 */
export function getRecentProducts(subdomain: string, clientSlug: string): RecentProductItem[] {
  const all = loadAll();
  return all.filter(
    (item) => item.subdomain === subdomain && item.clientSlug === clientSlug
  );
}

/** 상품 상세 진입 시 호출: 목록 앞에 추가(중복 시 기존 제거 후 맨 앞), 최대 20개 */
export function addRecentProduct(
  subdomain: string,
  clientSlug: string,
  product: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
    base_price: number;
    sale_price: number | null;
    status: string;
  }
): void {
  const all = loadAll();
  const filtered = all.filter((item) => !(item.subdomain === subdomain && item.clientSlug === clientSlug && item.id === product.id));
  const newItem: RecentProductItem = {
    ...product,
    subdomain,
    clientSlug,
    viewed_at: new Date().toISOString(),
  };
  const next = [newItem, ...filtered].filter(
    (item) => item.subdomain === subdomain && item.clientSlug === clientSlug
  ).slice(0, MAX_ITEMS);
  const rest = all.filter(
    (item) => item.subdomain !== subdomain || item.clientSlug !== clientSlug
  );
  save([...next, ...rest]);
}

/** 목록에서 한 건 제거 (삭제 버튼) */
export function removeRecentProduct(
  subdomain: string,
  clientSlug: string,
  productId: string
): void {
  const all = loadAll();
  const next = all.filter(
    (item) =>
      !(item.subdomain === subdomain && item.clientSlug === clientSlug && item.id === productId)
  );
  save(next);
}
