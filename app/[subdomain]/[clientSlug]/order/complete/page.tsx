"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { OrderGuard } from "@/components/shop/OrderGuard";
import { useShopTemplate } from "@/components/shop/ShopTemplateContext";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";
import { BOTTOM_NAV_HEIGHT } from "@/components/shop/ShopLayout";

/**
 * Phase E1: 주문 완료 페이지 (ViewPay returnUrl 리다이렉트 대상)
 * Query: orderId, cgTid(또는 tid 등) → complete API 호출 후 주문번호·결제 완료 안내
 * ViewPay가 returnUrl 리다이렉트 시 쿼리 또는 hash(#...)로 결제 ID를 넘길 수 있으므로 둘 다 수용.
 */

const PRIMARY = "#D6A8E0";
const PRIMARY_LIGHT = "#F3E8F5";
const TEXT = "#333333";
const TEXT_MUTED = "#6B7280";
const CARD_RADIUS = "12px";

/** 쿼리/해시에서 결제 거래 ID 추출 (ViewPay cgTid / tid / paymentId 등) */
function getPaymentIdFromSearch(searchParams: URLSearchParams | null): string {
  if (!searchParams) return "";

  // 1차: 단일 파라미터 (기존 방식) — cgTid, tid 등 직접 전달된 경우
  const names = ["cgTid", "tid", "tId", "paymentId", "transactionId", "cg_tid"];
  for (const name of names) {
    const v = searchParams.get(name)?.trim();
    if (v) return v;
  }

  // 2차: ViewPay가 data 쿼리 파라미터에 JSON 문자열로 event 전체를 인코딩해 전달하는 경우
  // 예: ?data={\"event\":{...\"data\":{\"cgTid\":\"CG1234\"}}}
  const dataParam = searchParams.get("data");
  if (!dataParam) return "";

  try {
    const parsed = JSON.parse(dataParam) as {
      event?: { data?: { cgTid?: string; tid?: string; tId?: string } };
      data?: { cgTid?: string; tid?: string; tId?: string };
      cgTid?: string;
    };

    // 우선 event.data.cgTid 를 시도
    const fromEventData =
      parsed?.event?.data?.cgTid ??
      parsed?.event?.data?.tid ??
      parsed?.event?.data?.tId;
    if (fromEventData && typeof fromEventData === "string") {
      return fromEventData.trim();
    }

    // fallback: 루트 data.cgTid 또는 최상위 cgTid
    const fromRootData =
      parsed?.data?.cgTid ?? parsed?.data?.tid ?? parsed?.data?.tId ?? parsed?.cgTid;
    if (fromRootData && typeof fromRootData === "string") {
      return fromRootData.trim();
    }
  } catch {
    // JSON 파싱 실패 시 조용히 무시하고 빈 문자열 반환
  }

  return "";
}

/** 브라우저 hash (#key=value&key2=value2)에서 결제 ID 추출 */
function getPaymentIdFromHash(): string {
  if (typeof window === "undefined" || !window.location.hash) return "";
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return getPaymentIdFromSearch(params);
}

type CompleteState = "idle" | "loading" | "success" | "error" | "no_payment_id";

export default function OrderCompletePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const template = useShopTemplate();
  const partner = template?.partner ?? null;
  const client = template?.client ?? null;

  const subdomain = params?.subdomain as string;
  const clientSlug = params?.clientSlug as string;
  const orderId = searchParams?.get("orderId")?.trim() ?? "";
  const cgTidFromQuery = getPaymentIdFromSearch(searchParams);

  const [cgTid, setCgTid] = useState(cgTidFromQuery);
  const [hashChecked, setHashChecked] = useState(false);

  const [state, setState] = useState<CompleteState>("idle");
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 쿼리에 cgTid가 없으면 hash에서 한 번 더 시도 (ViewPay가 # 으로 전달하는 경우)
  useEffect(() => {
    if (cgTidFromQuery) {
      setCgTid(cgTidFromQuery);
      setHashChecked(true);
      return;
    }
    if (typeof window !== "undefined") {
      const fromHash = getPaymentIdFromHash();
      if (fromHash) setCgTid(fromHash);
      setHashChecked(true);
    }
  }, [cgTidFromQuery]);

  useEffect(() => {
    if (!hashChecked && !cgTidFromQuery) setHashChecked(true);
  }, [hashChecked, cgTidFromQuery]);

  useEffect(() => {
    if (!orderId || !cgTid || !partner?.id || !client?.id) {
      if (orderId && hashChecked && !cgTid) {
        setState("no_payment_id");
        setErrorMessage(
          "결제가 완료되었을 수 있습니다. 주문 내역에서 결제 상태를 확인해 주세요."
        );
      }
      return;
    }
    let cancelled = false;
    setState("loading");
    const url = `/api/payment/viewpay/complete?orderId=${encodeURIComponent(orderId)}&cgTid=${encodeURIComponent(cgTid)}`;
    console.debug("[Order:Complete] 결제 완료 API 호출", { orderId, cgTid });
    shopFetch(url)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data?.orderNo) {
          console.debug("[Order:Complete] 결제 완료 처리 성공", { orderNo: data.orderNo });
          setOrderNo(data.orderNo);
          setState("success");
        } else {
          console.debug("[Order:Complete] 결제 완료 처리 실패", { message: data?.message });
          setState("error");
          setErrorMessage(data?.message ?? "결제 완료 처리에 실패했습니다.");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.debug("[Order:Complete] 결제 완료 API 예외", err);
        const msg = err?.message ?? "결제 완료 확인 중 오류가 발생했습니다.";
        setState("error");
        setErrorMessage(msg);
        toast(msg, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, cgTid, partner?.id, client?.id, hashChecked]);

  const handleContinueShopping = () => {
    router.push(`/${subdomain}/${clientSlug}`);
  };
  const handleOrderList = () => {
    router.push(`/${subdomain}/${clientSlug}/mypage/orders`);
  };

  const content = () => {
    if (state === "loading" || (state === "idle" && orderId && cgTid)) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D6A8E0] border-t-transparent" />
          <p className="text-[#6B7280]">결제 완료 확인 중...</p>
        </div>
      );
    }
    if (state === "success" && orderNo) {
      return (
        <div className="flex flex-col items-center gap-6 py-8">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            ✓
          </div>
          <h1 className="text-center text-xl font-semibold" style={{ color: TEXT }}>
            결제가 완료되었습니다
          </h1>
          <p className="text-center text-sm" style={{ color: TEXT_MUTED }}>
            주문번호
          </p>
          <p className="rounded-lg px-4 py-2 font-mono text-lg font-medium" style={{ backgroundColor: PRIMARY_LIGHT, color: TEXT }}>
            {orderNo}
          </p>
          <div className="mt-4 flex w-full max-w-xs flex-col gap-3">
            <button
              type="button"
              onClick={handleContinueShopping}
              className="w-full rounded-xl py-3.5 font-medium text-white transition opacity-90 hover:opacity-100"
              style={{ backgroundColor: PRIMARY }}
            >
              쇼핑 계속하기
            </button>
            <button
              type="button"
              onClick={handleOrderList}
              className="w-full rounded-xl border py-3.5 font-medium transition hover:bg-gray-50"
              style={{ borderColor: PRIMARY, color: PRIMARY }}
            >
              주문 내역
            </button>
          </div>
        </div>
      );
    }
    if (state === "error" || state === "no_payment_id") {
      return (
        <div className="flex flex-col items-center gap-6 py-8">
          <p className="text-center font-medium" style={{ color: TEXT }}>
            {errorMessage ?? "결제 완료 처리 중 문제가 발생했습니다."}
          </p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
            <button
              type="button"
              onClick={handleOrderList}
              className="w-full rounded-xl py-3.5 font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              주문 내역
            </button>
            <button
              type="button"
              onClick={handleContinueShopping}
              className="w-full rounded-xl border py-3.5 font-medium"
              style={{ borderColor: PRIMARY, color: PRIMARY }}
            >
              쇼핑 계속하기
            </button>
          </div>
        </div>
      );
    }
    if (!orderId) {
      return (
        <div className="flex flex-col items-center gap-4 py-12">
          <p className="text-center" style={{ color: TEXT_MUTED }}>
            잘못된 접근입니다.
          </p>
          <button
            type="button"
            onClick={handleContinueShopping}
            className="rounded-xl px-6 py-2 font-medium text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            쇼핑몰 홈으로
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <OrderGuard partnerId={partner?.id ?? undefined}>
      <div
        className="min-h-[60vh] w-full px-4"
        style={{
          paddingBottom: BOTTOM_NAV_HEIGHT + 24,
        }}
      >
        <div
          className="mx-auto max-w-md rounded-2xl p-6 shadow-sm"
          style={{
            backgroundColor: "#fff",
            borderRadius: CARD_RADIUS,
          }}
        >
          {content()}
        </div>
      </div>
    </OrderGuard>
  );
}
