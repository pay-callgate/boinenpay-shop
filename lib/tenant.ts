/**
 * Multi-Tenant 유틸 (Phase 0 T0-4).
 * partner_id, client_id 추출·필터: URL/호스트 기반 테넌트 식별.
 * 실제 DB 조회(partner_id, client_id UUID)는 API/Server Component에서 수행.
 */

/** 개발 환경에서 subdomain 시뮬레이션: 경로 첫 세그먼트를 subdomain으로 사용 */
const DEV_SUBDOMAIN_FROM_PATH = true;

export type TenantContext = {
  subdomain: string | null;
  clientSlug: string | null;
  isAdmin: boolean;
};

/**
 * 요청 URL에서 subdomain 추출.
 * - 프로덕션: host가 {subdomain}.shopping.com 형태면 subdomain 반환.
 * - 개발(localhost): pathname 첫 세그먼트를 subdomain으로 사용 (예: /yenmidang/admin → yenmidang).
 */
export function getSubdomainFromRequest(
  host: string,
  pathname: string
): string | null {
  if (typeof host !== "string" || typeof pathname !== "string") return null;

  const isLocalhost =
    host === "localhost" ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("localhost:");

  if (isLocalhost && DEV_SUBDOMAIN_FROM_PATH) {
    const segment = pathname.split("/").filter(Boolean)[0];
    return segment ?? null;
  }

  const domain = "shopping.com";
  if (!host.endsWith(domain) || host === domain) return null;
  const sub = host.slice(0, -(domain.length + 1));
  if (sub.includes(".")) return null;
  return sub || null;
}

/**
 * pathname에서 client slug 추출.
 * 예: /yenmidang/samsungelec → samsungelec, /yenmidang/samsungelec/products → samsungelec.
 */
export function getClientSlugFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  return segments[1] ?? null;
}

/**
 * 요청에서 테넌트 컨텍스트 추출 (subdomain, clientSlug, isAdmin).
 */
export function getTenantContext(
  host: string,
  pathname: string
): TenantContext {
  const subdomain = getSubdomainFromRequest(host, pathname);
  const isAdmin = pathname.includes("/admin");
  const clientSlug = isAdmin ? null : getClientSlugFromPath(pathname);
  return {
    subdomain,
    clientSlug: clientSlug ?? null,
    isAdmin,
  };
}
