"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { resolveShopClientSlug } from "@/lib/resolve-shop-client-slug";

/**
 * `/{subdomain}` — 고객에게 마스터 템플릿 미노출.
 * 거래처 전용 URL 또는 로그인으로만 유도 (파트너 어드민은 /admin).
 */
export default function PartnerRootRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const subdomain = (params?.subdomain as string) ?? "";

  useEffect(() => {
    if (!subdomain) return;
    if (status === "loading") return;

    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role === "partner_admin") {
      router.replace("/admin");
      return;
    }

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
  }, [subdomain, session, status, router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D6A8E0] border-t-transparent" />
    </div>
  );
}
