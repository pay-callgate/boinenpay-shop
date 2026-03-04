"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/** refetchInterval: 30분(1800초)마다 세션 갱신 — 활동 중엔 조기 만료 방지 */
const REFETCH_INTERVAL_SEC = 1800;

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider
      refetchInterval={REFETCH_INTERVAL_SEC}
      refetchOnWindowFocus={true}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
