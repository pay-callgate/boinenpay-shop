"use client";

import React from "react";
import { CreditCard, Loader2, ShoppingBag } from "lucide-react";
import type { CheckoutResumeOrder } from "@/lib/viewpay-checkout-context";
import {
  buildShopCartPath,
  buildShopHomePath,
} from "@/lib/viewpay-checkout-context";

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const TEXT = "#333333";
const TEXT_MUTED = "#6B7280";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ko-KR").format(price);
}

type GuideShellProps = {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
};

function GuideShell({ icon, title, description, children }: GuideShellProps) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: PRIMARY_LIGHT }}
          >
            {icon}
          </div>
          <h1 className="text-lg font-bold tracking-tight" style={{ color: TEXT }}>
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
              {description}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

export function CheckoutOrderGuideLoading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <Loader2
        className="h-10 w-10 animate-spin"
        style={{ color: PRIMARY }}
        aria-hidden
      />
      <p className="text-sm" style={{ color: TEXT_MUTED }}>
        주문 정보를 확인하고 있어요
      </p>
    </div>
  );
}

type PendingGuideProps = {
  order: CheckoutResumeOrder;
  subdomain: string;
  clientSlug: string;
  resumeLoading?: boolean;
  onResumePayment: () => void;
  /** 회원 checkout: 홈 primary + 장바구니 secondary */
  showCartButton?: boolean;
};

export function CheckoutOrderGuidePending({
  order,
  subdomain,
  clientSlug,
  resumeLoading = false,
  onResumePayment,
  showCartButton = false,
}: PendingGuideProps) {
  const homePath = buildShopHomePath(subdomain, clientSlug);
  const cartPath = buildShopCartPath(subdomain, clientSlug);

  return (
    <GuideShell
      icon={<CreditCard className="h-7 w-7" style={{ color: PRIMARY }} strokeWidth={2} />}
      title="결제를 계속 진행하시겠습니까?"
      description="접수된 주문이 있습니다. 아래에서 결제를 이어가실 수 있어요."
    >
      <div
        className="rounded-xl border px-4 py-3 text-left text-sm"
        style={{ borderColor: `${PRIMARY}55`, backgroundColor: PRIMARY_LIGHT }}
      >
        <p style={{ color: TEXT_MUTED }}>
          주문번호{" "}
          <span className="font-semibold" style={{ color: TEXT }}>
            {order.orderNo}
          </span>
        </p>
        <p className="mt-1" style={{ color: TEXT_MUTED }}>
          결제 금액{" "}
          <span className="text-base font-bold" style={{ color: TEXT }}>
            {formatPrice(order.totalAmount)}원
          </span>
        </p>
      </div>

      <button
        type="button"
        disabled={resumeLoading}
        onClick={onResumePayment}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
        style={{ backgroundColor: PRIMARY }}
      >
        {resumeLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            결제창 연결 중…
          </>
        ) : (
          "결제 이어가기"
        )}
      </button>

      {showCartButton ? (
        <>
          <a
            href={homePath}
            className="flex w-full items-center justify-center rounded-xl border-2 bg-white py-3.5 text-sm font-bold transition-colors hover:bg-[#F3E8F5]/40"
            style={{ borderColor: PRIMARY, color: PRIMARY }}
          >
            쇼핑몰 홈으로
          </a>
          <a
            href={cartPath}
            className="text-center text-sm font-medium underline-offset-2 hover:underline"
            style={{ color: TEXT_MUTED }}
          >
            장바구니 보기
          </a>
        </>
      ) : (
        <a
          href={homePath}
          className="flex w-full items-center justify-center rounded-xl border-2 bg-white py-3.5 text-sm font-bold transition-colors hover:bg-[#F3E8F5]/40"
          style={{ borderColor: PRIMARY, color: PRIMARY }}
        >
          쇼핑몰 홈으로
        </a>
      )}
    </GuideShell>
  );
}

type EmptyGuideProps = {
  subdomain: string;
  clientSlug: string;
  showCartButton?: boolean;
};

export function CheckoutOrderGuideEmpty({
  subdomain,
  clientSlug,
  showCartButton = false,
}: EmptyGuideProps) {
  const homePath = buildShopHomePath(subdomain, clientSlug);
  const cartPath = buildShopCartPath(subdomain, clientSlug);

  return (
    <GuideShell
      icon={<ShoppingBag className="h-7 w-7" style={{ color: PRIMARY }} strokeWidth={2} />}
      title="장바구니가 비었습니다"
      description="담으신 상품이 없어요. 쇼핑몰에서 상품을 선택한 뒤 다시 주문해 주세요."
    >
      <a
        href={homePath}
        className="flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-95"
        style={{ backgroundColor: PRIMARY }}
      >
        쇼핑몰 홈으로
      </a>
      {showCartButton ? (
        <a
          href={cartPath}
          className="flex w-full items-center justify-center rounded-xl border-2 bg-white py-3.5 text-sm font-bold transition-colors hover:bg-[#F3E8F5]/40"
          style={{ borderColor: PRIMARY, color: PRIMARY }}
        >
          장바구니로 이동
        </a>
      ) : null}
    </GuideShell>
  );
}
