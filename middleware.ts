import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getSubdomainFromRequest } from "@/lib/tenant";

const CALLGATE_REDIRECT_URL = "https://www.callgate.com/index.html";
const DEFAULT_SUBDOMAIN = "testpartner";

/**
 * Phase 0 T0-5: 루트 라우팅 규칙
 * - 프로덕션: shopping.com(/www) → CallGate 리다이렉트
 * - 프로덕션: {subdomain}.shopping.com/* → /{subdomain}/* 로 Rewrite (거래처 쇼핑몰 URL)
 * - 개발: localhost:3000/ → /testpartner/ 리다이렉트
 *
 * 어드민 세션: /admin/login 제외한 /admin/* 경로는 토큰 미존재 시 즉시 로그인으로 리다이렉트 (서버 우선)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  // 어드민: 로그인 페이지 제외, 토큰 없으면 즉시 리다이렉트 (Layout보다 먼저 실행)
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminLogin = pathname === "/admin/login";
  if (isAdminRoute && !isAdminLogin) {
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

  if (isLocalhost && (pathname === "/" || pathname === "")) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_SUBDOMAIN}/`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
