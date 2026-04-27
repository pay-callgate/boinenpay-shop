"use client";

import { useEffect, useMemo, useState } from "react";

export interface ShopLoginClientInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

export function getClientSlugFromCallbackUrl(url: string): string | null {
  try {
    const pathname = url.startsWith("http") ? new URL(url).pathname : url;
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 2) return parts[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * /api/shop/context 로 파트너·거래처 표시용 데이터 로드.
 * callbackUrl 에 /{subdomain}/{clientSlug}/... 가 있으면 해당 거래처 로고 등 매칭.
 */
export function useShopLoginContext(subdomain: string, callbackUrl: string) {
  const [partnerCompanyName, setPartnerCompanyName] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<ShopLoginClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const clientSlugForGuest = useMemo(
    () => getClientSlugFromCallbackUrl(callbackUrl),
    [callbackUrl]
  );

  useEffect(() => {
    if (!subdomain) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shop/context?subdomain=${encodeURIComponent(subdomain)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const name = (data?.partner?.company_name as string | undefined)?.trim() || null;
        if (!cancelled) setPartnerCompanyName(name);

        const slug = getClientSlugFromCallbackUrl(callbackUrl);
        if (!slug) {
          if (!cancelled) setClientInfo(null);
          return;
        }
        const clients: ShopLoginClientInfo[] = data?.clients ?? [];
        const client = clients.find((c) => c.slug === slug) ?? null;
        if (!cancelled) setClientInfo(client);
      } catch {
        if (!cancelled) {
          setPartnerCompanyName(null);
          setClientInfo(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subdomain, callbackUrl]);

  return {
    partnerCompanyName,
    clientInfo,
    loading,
    clientSlugForGuest,
  };
}
