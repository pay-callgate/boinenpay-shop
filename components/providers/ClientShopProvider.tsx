"use client";

import { SessionProvider } from "@/components/providers/SessionProvider";
import type { ReactNode } from "react";

/**
 * 쇼핑몰 영역([subdomain]/[clientSlug]) 전용 SessionProvider 래퍼.
 * SideMenu 등에서 useSession() 호출 시 컨텍스트가 끊기지 않도록 보장.
 * 서버 컴포넌트인 layout에서 사용하기 위한 클라이언트 컴포넌트.
 */
export function ClientShopProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
