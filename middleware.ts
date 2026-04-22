import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getSubdomainFromRequest } from "@/lib/tenant";

const CALLGATE_REDIRECT_URL = "https://www.callgate.com/index.html";

/**
 * NEXTAUTH_URL이 https://www... 인데 사용자가 apex(calllinkshop.com)로 진입하면
 * OAuth state 쿠키는 apex에 심기고 콜백은 www로만 들어가 OAuthCallback이 난다.
 * NEXTAUTH_URL의 hostname으로 308 리다이렉트하여 호스트를 통일한다.
 */
function redirectApexToNextAuthCanonicalHost(
  request: NextRequest
): NextResponse | null {
  const authBase = process.env.NEXTAUTH_URL?.trim();
  if (!authBase) return null;
  let canonicalHost: string;
  try {
    canonicalHost = new URL(authBase).hostname.toLowerCase();
  } catch {
    return null;
  }
  const rawHost = request.headers.get("host") ?? "";
  const host = rawHost.split(":")[0]?.toLowerCase() ?? "";
  if (!host || host === canonicalHost) return null;

  const apex = canonicalHost.replace(/^www\./, "");
  if (host !== apex) return null;

  const dest = request.nextUrl.clone();
  dest.hostname = canonicalHost;
  return NextResponse.redirect(dest, 308);
}

/**
 * Phase 0 T0-5: 루트 라우팅 규칙
 * - 루트(/) 접속 시 무조건 /admin(파트너사 로그인)으로 리다이렉트 (B2B SaaS 대문)
 * - 프로덕션: shopping.com(/www) → CallGate 리다이렉트
 * - 프로덕션: {subdomain}.shopping.com/* → /{subdomain}/* 로 Rewrite (거래처 쇼핑몰 URL)
 *
 * 어드민 세션: /admin/login 제외한 /admin/* 경로는 토큰 미존재 시 즉시 로그인으로 리다이렉트 (서버 우선)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  const canonicalHostRedirect = redirectApexToNextAuthCanonicalHost(request);
  if (canonicalHostRedirect) return canonicalHostRedirect;

  // 루트(/) 접속 시 무조건 파트너사 로그인(어드민)으로 리다이렉트 (B2B SaaS 대문)
  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  // 어드민: 로그인 페이지 제외, 토큰 없으면 즉시 리다이렉트 (Layout보다 먼저 실행)
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin = pathname === "/admin/login";
  /** 뉴런 브라우저 리턴 — 쿼리(rwr_*) 보존을 위해 비로그인 허용 (서버에서 Service Role로 반영) */
  const isAdminNewrunPoReturn = pathname === "/admin/newrun/po-return";
  if (isAdminRoute && !isAdminLogin && !isAdminNewrunPoReturn) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) {
      console.log("[MIDDLEWARE] 어드민 인증 없음 → 로그인 리다이렉트", { pathname });
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname || "/admin");
      return NextResponse.redirect(loginUrl);
    }
  }

  // 중앙 집중형 어드민: /admin, /admin/* 는 서브도메인 Rewrite 대상에서 제외 (CallLinkShopping.com/admin)
  if (isAdminRoute) {
    return NextResponse.next();
  }

  const isLocalhost =
    host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const isShoppingRoot =
    host === "shopping.com" ||
    host === "www.shopping.com" ||
    host.endsWith(".shopping.com");

  if (!isLocalhost && isShoppingRoot) {
    const rootDomains = ["shopping.com", "www.shopping.com"];
    if (rootDomains.includes(host)) {
      return NextResponse.redirect(CALLGATE_REDIRECT_URL);
    }
    // 프로덕션: {subdomain}.shopping.com → /{subdomain}/* Rewrite (거래처 쇼핑몰만, 어드민 제외)
    const subdomain = getSubdomainFromRequest(host, pathname);
    if (subdomain) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.startsWith("/") ? `/${subdomain}${pathname}` : `/${subdomain}/${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
