"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  isCustomerForbiddenMasterTemplatePath,
  resolveShopClientSlug,
  SHOP_MASTER_PREVIEW_SLUG,
} from "@/lib/resolve-shop-client-slug";

type Props = {
  children: ReactNode;
};

/**
 * 고객(end_customer·비로그인)이 마스터 템플릿 URL(`/{subdomain}`, `/{subdomain}/_preview`)에
 * 머무르지 않도록 거래처 전용 홈 또는 로그인으로 보냄. partner_admin 은 _preview 만 허용.
 */
export function MasterTemplateCustomerGate({ children }: Props) {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const subdomain = (params?.subdomain as string) ?? "";
  const clientSlug = (params?.clientSlug as string) ?? "";
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!subdomain || typeof window === "undefined") return;
    if (status === "loading") return;

    const pathname = window.location.pathname;
    const role = (session?.user as { role?: string } | undefined)?.role;
    const isPartnerAdmin = role === "partner_admin";

    if (clientSlug === SHOP_MASTER_PREVIEW_SLUG) {
      if (isPartnerAdmin) {
        setBlocked(false);
        return;
      }
      setBlocked(true);
      const slug = resolveShopClientSlug({ subdomain });
      if (slug) {
        router.replace(`/${subdomain}/${slug}`);
      } else {
        router.replace(`/${subdomain}/login`);
      }
      return;
    }

    if (!isCustomerForbiddenMasterTemplatePath(pathname, subdomain)) {
      setBlocked(false);
      return;
    }

    if (isPartnerAdmin) {
      router.replace("/admin");
      setBlocked(true);
      return;
    }

    setBlocked(true);

    const slug = resolveShopClientSlug({ subdomain });
    if (slug) {
      router.replace(`/${subdomain}/${slug}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/shop/context?subdomain=${encodeURIComponent(subdomain)}`
        );
        if (!res.ok || cancelled) {
          if (!cancelled) router.replace(`/${subdomain}/login`);
          return;
        }
        const data = await res.json();
        const clients = (data?.clients ?? []) as { slug: string }[];
        if (cancelled) return;
        if (clients.length === 1 && clients[0]?.slug) {
          router.replace(`/${subdomain}/${clients[0].slug}`);
          return;
        }
        router.replace(`/${subdomain}/login`);
      } catch {
        if (!cancelled) router.replace(`/${subdomain}/login`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subdomain, clientSlug, session, status, router]);

  if (blocked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D6A8E0] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
