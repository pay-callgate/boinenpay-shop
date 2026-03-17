"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronRight, Package, User, Heart, MapPin, CreditCard, Truck, PackageCheck, LogOut } from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import type { ShopPartner, ShopClient } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";

/**
 * T6-1: 마이페이지 홈
 * /{subdomain}/{clientSlug}/mypage
 * - 헤더/하단 네비는 글로벌 레이아웃에서 제공
 */

const PRIMARY = "#D6A8E0";

interface Stats {
  pending_payment: number;
  preparing: number;
  shipping: number;
  delivered: number;
}

const MENU_ITEMS = [
  { label: "주문 조회", path: "/mypage/orders", icon: Package },
  { label: "회원 정보", path: "/mypage/profile", icon: User },
  { label: "관심상품", path: "/mypage/wishlist", icon: Heart },
  { label: "배송 주소록 관리", path: "/mypage/addresses", icon: MapPin },
] as const;

const ORDER_STATUS_ITEMS = [
  { key: "pending_payment", label: "입금전", icon: CreditCard },
  { key: "preparing", label: "배송준비중", icon: Package },
  { key: "shipping", label: "배송중", icon: Truck },
  { key: "delivered", label: "배송완료", icon: PackageCheck },
] as const;

export default function MyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const template = useShopTemplate();
  const partner = (template?.partner ?? null) as ShopPartner | null;
  const client = (template?.client ?? null) as ShopClient | null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [stats, setStats] = useState<Stats | null>(null);

  // 주문 현황 통계 (전역 shopFetch — 401/403 시 자동 세션 만료 처리)
  useEffect(() => {
    if (!client?.id) return;
    shopFetch(`/api/mypage/stats?clientId=${client.id}`)
      .then((res) => (res.ok ? res.json() : { stats: null }))
      .then((data) => setStats(data?.stats ?? null))
      .catch(() => setStats(null));
  }, [client?.id]);

  const base = `/${subdomain}/${clientSlug}`;

  if (template == null) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!partner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
        <p className="mb-4 text-gray-500">접근할 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }

  if (!client && clientSlug !== "_preview") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
        <p className="mb-4 text-gray-500">거래처를 찾을 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.push(base)}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }

  const isPreview = clientSlug === "_preview" && !client;
  if (isPreview) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <p className="mb-2 text-sm font-medium text-gray-700">마스터 템플릿 미리보기</p>
        <p className="mb-6 text-sm text-gray-500">
          주문·결제는 전용 주문 링크에서 이용 가능합니다.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/${subdomain}/${clientSlug}`)}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          홈으로
        </button>
      </div>
    );
  }

  const content = (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-[430px] space-y-4 px-4 pt-4">
        {/* 1. 프로필 & 등급 카드 */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              {session?.user?.name?.charAt(0) || "?"}
            </div>
            <div>
              <p
                className="text-lg font-semibold"
                style={{ color: PRIMARY }}
              >
                {session?.user?.name ?? "회원"}님
              </p>
              <p className="mt-0.5 text-sm text-gray-500">
                구매등급:{" "}
                <span className="font-medium" style={{ color: PRIMARY }}>
                  일반회원
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* 2. 나의 주문처리 현황 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">
            나의 주문 현황
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {ORDER_STATUS_ITEMS.map((item) => {
              const count = stats?.[item.key as keyof Stats] ?? 0;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    router.push(`${base}/mypage/orders?status=${item.key}`)
                  }
                  className="flex flex-col items-center justify-center rounded-xl py-3 transition-colors hover:bg-gray-50"
                >
                  <Icon
                    className="mb-1 h-5 w-5 text-gray-400"
                    strokeWidth={1.5}
                  />
                  <span className="text-[10px] text-gray-500">{item.label}</span>
                  <span
                    className="mt-0.5 text-lg font-bold"
                    style={{ color: PRIMARY }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 border-t border-gray-100 pt-3 text-center text-xs text-gray-400">
            취소 0건 · 교환 0건 · 반품 0건
          </p>
        </section>

        {/* 3. 간편 메뉴 리스트 */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => router.push(`${base}${item.path}`)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className="h-5 w-5 text-gray-400"
                        strokeWidth={1.5}
                      />
                      <span className="text-[15px] font-medium text-gray-800">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-gray-300"
                      strokeWidth={2}
                    />
                  </button>
                </li>
              );
            })}
            {/* 로그아웃: 메뉴 리스트 맨 아래, 같은 카드 안·같은 스타일, 우측 꺾쇠 없음 */}
            {session?.user && (
              <li>
                <button
                  type="button"
                  onClick={() =>
                    signOut({
                      callbackUrl: base,
                      redirect: true,
                    })
                  }
                  className="flex w-full items-center px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                >
                    <div className="flex items-center gap-3">
                    <LogOut
                      className="h-5 w-5 shrink-0 text-[#4B5563]"
                      strokeWidth={1.5}
                    />
                    <span className="text-[15px] font-medium text-gray-800">
                      로그아웃
                    </span>
                  </div>
                </button>
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );

  return (
    <OrderGuard partnerId={partner.id}>
      {content}
    </OrderGuard>
  );
}
