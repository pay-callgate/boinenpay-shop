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

function CategorySkeleton() {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-2">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          className="h-8 w-20 rounded-full bg-slate-200/80 animate-pulse"
        />
      ))}
    </div>
  );
}

function ProductSkeletonGrid() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 px-4 pb-6">
      {Array.from({ length: 6 }).map((_, idx) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={idx} className="space-y-2">
          <div className="h-40 rounded-2xl bg-slate-200/80 animate-pulse" />
          <div className="h-3 w-5/6 rounded-full bg-slate-200/80 animate-pulse" />
          <div className="h-3 w-3/5 rounded-full bg-slate-200/70 animate-pulse" />
          <div className="h-4 w-1/2 rounded-full bg-slate-300/80 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/**
 * 거래처 쇼핑몰 메인 페이지 (글로벌 레이아웃 적용)
 * /{subdomain}/{clientSlug}
 * - 헤더/하단 네비는 layout의 ShopGlobalLayout에서 제공
 * - 상단 헤더/네비는 레이아웃에서 이미 렌더링되므로, 여기서는 본문만 스켈레톤 처리
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
          `/api/shop/categories?partnerId=${partner.id}&onlyWithProducts=false`
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
  }, [partner?.id, client]);

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

  if (!partner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 유효하지 않은 거래처 slug: 파트너는 있으나 해당 slug 거래처 없음 (마스터 미리보기는 _preview 사용)
  if (partner && !client && clientSlug !== "_preview") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
        <p className="text-center font-medium text-slate-800">해당 거래처 링크를 찾을 수 없습니다.</p>
        <p className="mt-1 text-center text-sm text-slate-500">주소를 확인하시거나 파트너 홈으로 이동해 주세요.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}`)}
          className="mt-6 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#D6A8E0" }}
        >
          파트너 홈으로 이동
        </button>
      </div>
    );
  }

  return (
    <>
      <ShopMainHome
        partner={partner}
        client={client ?? null}
        subdomain={subdomain}
        clientSlug={clientSlug}
        categories={categories}
        productsByCategory={productsByCategory}
      />
      {loading && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 top-[56px] z-30 bg-gradient-to-b from-white/70 via-white/90 to-white/95">
          <CategorySkeleton />
          <ProductSkeletonGrid />
        </div>
      )}
      {autoMatching && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div
            className="inline-flex max-w-md items-center gap-3 rounded-full bg-slate-900/90 px-4 py-2 text-xs text-white shadow-lg"
            style={{ backdropFilter: "blur(10px)" }}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
            </span>
            <span className="flex-1 text-left">
              거래처 정보를 등록하는 중이에요. 잠시만 기다려 주세요.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
