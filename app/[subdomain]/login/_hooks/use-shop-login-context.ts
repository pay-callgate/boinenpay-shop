"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getClientSlugFromShopPath,
  resolveShopClientSlug,
} from "@/lib/resolve-shop-client-slug";

export interface ShopLoginClientInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

export { getClientSlugFromShopPath as getClientSlugFromCallbackUrl };

/**
 * /api/shop/context 로 파트너·거래처 표시용 데이터 로드.
 * slug: callbackUrl → 쿼리 → 쿠키 (`resolveShopClientSlug`).
 */
export function useShopLoginContext(
  subdomain: string,
  callbackUrl: string,
  queryClientSlug?: string | null
) {
  const [partnerCompanyName, setPartnerCompanyName] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<ShopLoginClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const resolvedClientSlug = useMemo(
    () =>
      resolveShopClientSlug({
        subdomain,
        callbackUrl,
        queryClientSlug,
      }),
    [subdomain, callbackUrl, queryClientSlug]
  );

  const clientSlugForGuest = resolvedClientSlug;

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

        const slug = resolvedClientSlug;
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
  }, [subdomain, resolvedClientSlug]);

  return {
    partnerCompanyName,
    clientInfo,
    loading,
    clientSlugForGuest,
    resolvedClientSlug,
  };
}
