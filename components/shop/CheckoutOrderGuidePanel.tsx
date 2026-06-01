"use client";

import React from "react";
import { CreditCard, Loader2, ShoppingBag } from "lucide-react";
import {
  buildShopCartPath,
  buildShopHomePath,
  type CheckoutResumeOrder,
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

type PendingOfferProps = {
  order: CheckoutResumeOrder;
  cartMismatch?: boolean;
  onLoadOrder: () => void;
  onDismiss: () => void;
  /** ViewPay sync 이슈로 임시 비활성 — 재활성 시 아래 주석 해제
   * resumeLoading?: boolean;
   * onResumePayment: () => void;
   */
};

/** 선택형 pending 패널 — overlay (강제 리다이렉트 없음) */
export function CheckoutOrderGuidePendingOffer({
  order,
  cartMismatch = false,
  onLoadOrder,
  onDismiss,
}: PendingOfferProps) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/35 px-4 pb-6 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-offer-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: PRIMARY_LIGHT }}
          >
            <CreditCard className="h-7 w-7" style={{ color: PRIMARY }} strokeWidth={2} />
          </div>
          <h2 id="pending-offer-title" className="text-lg font-bold" style={{ color: TEXT }}>
            진행 중인 주문이 있어요
          </h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
            주문 정보를 불러오시겠습니까?
          </p>
        </div>

        {cartMismatch ? (
          <p
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-xs leading-relaxed text-amber-950"
            role="note"
          >
            주문 내용이 장바구니 상품과 다릅니다. 이어서 하시겠습니까?
          </p>
        ) : null}

        <div className="mt-4 rounded-xl bg-purple-50 px-4 py-4 text-left text-sm">
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

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onLoadOrder}
            className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-95"
            style={{ backgroundColor: PRIMARY }}
          >
            주문 불러오기
          </button>
          {/*
          결제만 이어가기 — ViewPay returnUrl(cgTid) 미동기화 이슈로 임시 비활성
          <button
            type="button"
            disabled={resumeLoading}
            onClick={onResumePayment}
            className="w-full rounded-xl border-2 bg-white py-3.5 text-sm font-bold disabled:opacity-60"
            style={{ borderColor: PRIMARY, color: PRIMARY }}
          >
            {resumeLoading ? "결제창 연결 중…" : "결제만 이어가기"}
          </button>
          */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 text-sm font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
          >
            무시하고 새로 주문하기
          </button>
        </div>
      </div>
    </div>
  );
}

type PaidNoticeProps = {
  orderNo: string;
  completePath: string;
  onDismiss: () => void;
};

export function CheckoutOrderGuidePaidNotice({
  orderNo,
  completePath,
  onDismiss,
}: PaidNoticeProps) {
  return (
    <div
      className="mx-4 mb-4 rounded-xl border px-4 py-3"
      style={{ borderColor: `${PRIMARY}66`, backgroundColor: PRIMARY_LIGHT }}
      role="status"
    >
      <p className="text-sm font-medium" style={{ color: TEXT }}>
        이미 결제된 주문이 있습니다. (주문번호 {orderNo})
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a
          href={completePath}
          className="text-sm font-bold underline-offset-2 hover:underline"
          style={{ color: PRIMARY }}
        >
          주문 완료 보기
        </a>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium"
          style={{ color: TEXT_MUTED }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
