"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ShopMainHome } from "@/components/shop/ShopMainHome";
import type { ShopPartner, ShopClient } from "@/components/shop/ShopLayout";
import type { ShopCategory, ShopProduct } from "@/components/shop/ShopMainHome";

/**
 * 파트너 메인 페이지 (마스터 템플릿 미리보기)
 * URL: /{subdomain}
 * - ShopLayout + ShopMainHome 공유
 * - 상품/장바구니/마이페이지 등 모든 화면 진입 허용 (_preview 경로)
 * - 주문·결제·장바구니 담기 액션만 미리보기 시 alert로 차단
 */
export default function PartnerMainPage() {
  const params = useParams();
  const subdomain = (params?.subdomain as string) ?? "";

  const [partner, setPartner] = useState<ShopPartner | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<
    Record<string, ShopProduct[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subdomain) return;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const contextRes = await fetch(
          `/api/shop/context?subdomain=${subdomain}`
        );
        if (!contextRes.ok) {
          setError("파트너를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }
        const { partner: partnerFromApi } = await contextRes.json();
        if (!partnerFromApi) {
          setError("파트너를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }
        setPartner(partnerFromApi);

        const catRes = await fetch(
          `/api/shop/categories?partnerId=${partnerFromApi.id}&onlyWithProducts=false`
        );
        if (!catRes.ok) {
          setLoading(false);
          return;
        }
        const catData = await catRes.json();
        const cats = catData.categories || [];
        setCategories(cats);

        const productsMap: Record<string, ShopProduct[]> = {};
        await Promise.all(
          cats.map(async (cat: ShopCategory) => {
            const prodRes = await fetch(
              `/api/shop/products?partnerId=${partnerFromApi.id}&categoryId=${cat.id}&limit=4`
            );
            if (prodRes.ok) {
              const prodData = await prodRes.json();
              productsMap[cat.id] = prodData.products || [];
            }
          })
        );
        setProductsByCategory(productsMap);
      } catch {
        setError("정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [subdomain]);

  if (!subdomain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
        <p className="text-center font-medium text-slate-800">
          {error || "파트너를 찾을 수 없습니다."}
        </p>
        <a
          href="/"
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#D6A8E0" }}
        >
          홈으로 이동
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-slate-600">로딩 중...</p>
      </div>
    );
  }

  return (
    <ShopLayout
      orderAllowed={false}
      subdomain={subdomain}
      clientSlug={null}
      partner={partner}
      client={null}
    >
      <ShopMainHome
        partner={partner}
        client={null}
        subdomain={subdomain}
        clientSlug={null}
        categories={categories}
        productsByCategory={productsByCategory}
      />
    </ShopLayout>
  );
}
