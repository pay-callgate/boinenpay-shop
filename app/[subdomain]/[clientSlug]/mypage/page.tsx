"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  ChevronRight,
  Package,
  User,
  Heart,
  MapPin,
  Truck,
  LogOut,
  Wallet,
  Flower2,
  CircleCheck,
  type LucideIcon,
} from "lucide-react";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import type { ShopPartner, ShopClient } from "@/components/shop/ShopLayout";
import { shopFetch } from "@/lib/shop-fetch";
import type { ShopFulfillmentStageKey } from "@/lib/shop/customer-order-fulfillment";

/**
 * T6-1: 마이페이지 홈
 * /{subdomain}/{clientSlug}/mypage
 * - 헤더/하단 네비는 글로벌 레이아웃에서 제공
 */

const PRIMARY = "#D6A8E0";

type MypageOrderStats = Record<ShopFulfillmentStageKey, number>;

const EMPTY_STATS: MypageOrderStats = {
  payment_done: 0,
  crafting: 0,
  departure: 0,
  complete: 0,
};

const ORDER_DASHBOARD_STEPS: readonly {
  stage: ShopFulfillmentStageKey;
  label: string;
  shortHint: string;
  icon: LucideIcon;
  highlightWhenPositive: boolean;
}[] = [
  {
    stage: "payment_done",
    label: "결제 완료",
    shortHint: "접수·결제 완료",
    icon: Wallet,
    highlightWhenPositive: false,
  },
  {
    stage: "crafting",
    label: "화환 제작중",
    shortHint: "제작 진행",
    icon: Flower2,
    highlightWhenPositive: true,
  },
  {
    stage: "departure",
    label: "배송 출발",
    shortHint: "현장 이동 중",
    icon: Truck,
    highlightWhenPositive: true,
  },
  {
    stage: "complete",
    label: "배송 완료",
    shortHint: "배송 완료된 주문",
    icon: CircleCheck,
    highlightWhenPositive: false,
  },
] as const;

function resolveDashboardCountClass(
  stage: ShopFulfillmentStageKey,
  n: number,
  highlightWhenPositive: boolean
): string {
  if (n < 1) {
    return "text-[15px] font-semibold tabular-nums text-gray-300 sm:text-base";
  }
  if (highlightWhenPositive) {
    if (stage === "crafting") {
      return "text-lg font-bold tabular-nums text-orange-600 sm:text-xl";
    }
    if (stage === "departure") {
      return "text-lg font-bold tabular-nums text-indigo-600 sm:text-xl";
    }
  }
  if (stage === "payment_done") {
    return "text-[15px] font-bold tabular-nums text-sky-600 sm:text-lg";
  }
  return "text-[15px] font-bold tabular-nums text-gray-900 sm:text-lg";
}

const MENU_ITEMS = [
  { label: "주문 조회", path: "/mypage/orders", icon: Package },
  { label: "회원 정보", path: "/mypage/profile", icon: User },
  { label: "관심상품", path: "/mypage/wishlist", icon: Heart },
  { label: "배송 주소록 관리", path: "/mypage/addresses", icon: MapPin },
] as const;

export default function MyPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const template = useShopTemplate();
  const partner = (template?.partner ?? null) as ShopPartner | null;
  const client = (template?.client ?? null) as ShopClient | null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;

  const [stats, setStats] = useState<MypageOrderStats | null>(null);

  // 주문 현황 통계 — 세션 확정 후에만 요청, 401 시 전역 signOut 금지(Silent Fail)
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !client?.id) return;
    let cancelled = false;
    shopFetch(`/api/mypage/stats?clientId=${client.id}`, {
      handleSessionExpiry: false,
    })
      .then((res) => {
        if (!res.ok) {
          if (typeof window !== "undefined") {
            console.warn("[MyPage] stats non-OK (silent)", res.status, client.id);
          }
          return { stats: null };
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          const s = data?.stats as Partial<MypageOrderStats> | undefined;
          setStats(
            s
              ? {
                  ...EMPTY_STATS,
                  ...s,
                }
              : null
          );
          if (typeof window !== "undefined" && data?.stats) {
            console.log("[MyPage] stats loaded", { clientId: client.id });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, client?.id]);

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

        {/* 2. 나의 주문 현황 — 주문 목록 `shopStage`와 동일 4단계 */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-sm font-semibold text-gray-800">
            나의 주문 현황
          </h2>
          <p className="mb-3 text-[11px] leading-snug text-gray-500">
            결제가 완료된 주문만 집계합니다. 각 단계를 누르면 해당 탭으로 이동합니다.
          </p>

          <div className="flex w-full items-stretch gap-0.5">
            {ORDER_DASHBOARD_STEPS.map((step, i) => {
              const Icon = step.icon;
              const count = (stats ?? EMPTY_STATS)[step.stage];
              const countCls = resolveDashboardCountClass(
                step.stage,
                count,
                step.highlightWhenPositive
              );
              const iconMuted = count < 1 ? "text-gray-300" : "text-gray-500";

              return (
                <Fragment key={step.stage}>
                  {i > 0 ? (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 self-center text-gray-200"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                  <button
                    type="button"
                    title={step.shortHint}
                    onClick={() =>
                      router.push(
                        `${base}/mypage/orders?shopStage=${encodeURIComponent(step.stage)}`
                      )
                    }
                    className="min-w-0 flex-1 rounded-xl py-2 transition-colors hover:bg-gray-50 active:bg-gray-100"
                  >
                    <div className="flex flex-col items-center gap-1 px-0.5">
                      <Icon
                        className={`h-5 w-5 sm:h-6 sm:w-6 ${iconMuted}`}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="max-w-[4.25rem] text-center text-[9px] font-medium leading-tight text-gray-600 sm:max-w-none sm:text-[10px]">
                        {step.label}
                      </span>
                      <span className={countCls}>{count}</span>
                    </div>
                  </button>
                </Fragment>
              );
            })}
          </div>
          <p className="mt-3 border-t border-gray-100 pt-3 text-center text-[11px] text-gray-400">
            전체 목록은「주문 조회」에서 확인할 수 있어요.
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
    <OrderGuard
      partnerId={partner.id}
      shopClientId={client?.id}
      shopClientName={client?.name ?? undefined}
    >
      {content}
    </OrderGuard>
  );
}
