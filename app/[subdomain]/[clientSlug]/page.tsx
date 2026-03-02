"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUserClient } from "@/hooks/useUserClient";
import { setClientSourceCookie } from "@/lib/user-client";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { ShopMainHome } from "@/components/shop/ShopMainHome";
import type { ShopPartner, ShopClient } from "@/components/shop/ShopLayout";
import type { ShopCategory, ShopProduct } from "@/components/shop/ShopMainHome";

/**
 * 거래처 쇼핑몰 메인 페이지 (글로벌 레이아웃 적용)
 * /{subdomain}/{clientSlug}
 * - 헤더/하단 네비는 layout의 ShopGlobalLayout에서 제공
 */
export default function ClientShopPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const template = useShopTemplate();
  const partner = (template?.partner ?? null) as ShopPartner | null;
  const client = (template?.client ?? null) as ShopClient | null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<
    Record<string, ShopProduct[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoMatching, setAutoMatching] = useState(false);

  const { autoMatch, isMatched, refresh } = useUserClient(partner?.id);

  // 컨텍스트에서 partner 없으면 로딩 종료 (invalid route). _preview는 client 없이 partner만으로 메인 노출
  const isPreview = clientSlug === "_preview";
  useEffect(() => {
    if (template != null && !partner) setLoading(false);
  }, [template, partner]);

  // 레이아웃에서 partner 제공 시 카테고리/상품 로드. 거래처 전용일 때만 쿠키 설정
  useEffect(() => {
    if (!partner?.id) return;
    if (client) setClientSourceCookie(client.id, client.slug);
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const catRes = await fetch(
          `/api/shop/categories?partnerId=${partner.id}&onlyWithProducts=true`
        );
        if (cancelled) return;
        if (!catRes.ok) {
          setError("카테고리를 불러올 수 없습니다.");
          return;
        }
        const catData = await catRes.json();
        const cats = catData.categories || [];
        setCategories(cats);
        const productsMap: Record<string, ShopProduct[]> = {};
        await Promise.all(
          cats.map(async (cat: ShopCategory) => {
            const prodRes = await fetch(
              `/api/shop/products?partnerId=${partner.id}&categoryId=${cat.id}&limit=4`
            );
            if (prodRes.ok) {
              const prodData = await prodRes.json();
              productsMap[cat.id] = prodData.products || [];
            }
          })
        );
        if (!cancelled) setProductsByCategory(productsMap);
      } catch {
        if (!cancelled) setError("정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partner?.id]);

  // T3.5-1: 로그인 후 자동 매칭 (거래처 전용 URL에서만, _preview 제외)
  useEffect(() => {
    async function performAutoMatch() {
      if (
        status === "authenticated" &&
        session?.user &&
        partner?.id &&
        client &&
        clientSlug &&
        clientSlug !== "_preview" &&
        !isMatched &&
        !autoMatching
      ) {
        setAutoMatching(true);
        const success = await autoMatch(clientSlug, partner.id);
        if (success) await refresh();
        setAutoMatching(false);
      }
    }
    performAutoMatch();
  }, [status, session, partner, client, clientSlug, isMatched, autoMatching, autoMatch, refresh]);

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-slate-800">페이지를 찾을 수 없습니다</h1>
        <p className="mt-1 text-center text-sm text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}`)}
          className="mt-6 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#D6A8E0" }}
        >
          홈으로 이동
        </button>
      </div>
    );
  }

  // 비로그인 사용자도 쇼핑몰 메인 조회 가능 (로그인은 주문/결제 시 OrderGuard에서만 요구)
  if (autoMatching) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200"
          style={{ borderTopColor: "#D6A8E0" }}
          aria-hidden
        />
        <p className="mt-4 text-sm text-slate-600">거래처 정보를 등록하는 중...</p>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <ShopMainHome
      partner={partner}
      client={client ?? null}
      subdomain={subdomain}
      clientSlug={clientSlug}
      categories={categories}
      productsByCategory={productsByCategory}
    />
  );
}
