"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CartDuplicateConfirmModal } from "@/components/shop/CartDuplicateConfirmModal";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";

export type AddToCartParams = {
  clientId: string;
  productId: string;
  quantity?: number;
  optionJson?: Record<string, string> | null;
  forceGuestCart?: boolean;
};

type UseAddToCartWithDuplicateCheckConfig = {
  subdomain: string;
  clientSlug: string;
  /** false면 담기 중단 (로그인·소속·미리보기 등) */
  guard?: () => boolean;
};

type DuplicateCheckResponse = {
  exists: boolean;
  cartItemId?: string;
  quantity?: number;
};

function buildDuplicateCheckUrl(params: AddToCartParams): string {
  const qs = new URLSearchParams({
    clientId: params.clientId,
    productId: params.productId,
  });
  if (params.optionJson && Object.keys(params.optionJson).length > 0) {
    qs.set("optionJson", JSON.stringify(params.optionJson));
  }
  if (params.forceGuestCart) {
    qs.set("guestCart", "1");
  }
  return `/api/cart/duplicate-check?${qs.toString()}`;
}

export function useAddToCartWithDuplicateCheck({
  subdomain,
  clientSlug,
  guard,
}: UseAddToCartWithDuplicateCheckConfig) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, setPending] = useState<AddToCartParams | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const postAddToCart = useCallback(async (params: AddToCartParams) => {
    const res = await shopFetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: params.clientId,
        productId: params.productId,
        quantity: params.quantity ?? 1,
        optionJson: params.optionJson ?? null,
        ...(params.forceGuestCart ? { forceGuestCart: true } : {}),
      }),
      handleSessionExpiry: params.forceGuestCart ? false : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast((err as { error?: string }).error || "장바구니 담기에 실패했습니다.", "error");
      return false;
    }
    const data = await res.json();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cart-updated"));
    }
    toast((data as { message?: string }).message || "장바구니에 추가되었습니다.", "success");
    return true;
  }, []);

  const requestAddToCart = useCallback(
    async (params: AddToCartParams) => {
      if (guard && !guard()) return;
      setAddingProductId(params.productId);
      try {
        const checkRes = await shopFetch(buildDuplicateCheckUrl(params), {
          handleSessionExpiry: params.forceGuestCart ? false : undefined,
        });
        if (!checkRes.ok) {
          const err = await checkRes.json().catch(() => ({}));
          toast((err as { error?: string }).error || "장바구니 확인에 실패했습니다.", "error");
          return;
        }
        const check = (await checkRes.json()) as DuplicateCheckResponse;
        if (check.exists) {
          setPending(params);
          setModalOpen(true);
          return;
        }
        await postAddToCart(params);
      } catch {
        toast("네트워크 오류가 발생했습니다.", "error");
      } finally {
        setAddingProductId(null);
      }
    },
    [guard, postAddToCart]
  );

  const handleConfirmAdd = useCallback(async () => {
    if (!pending) return;
    setModalLoading(true);
    try {
      const ok = await postAddToCart(pending);
      if (ok) {
        setModalOpen(false);
        setPending(null);
      }
    } finally {
      setModalLoading(false);
    }
  }, [pending, postAddToCart]);

  const handleGoToCart = useCallback(() => {
    setModalOpen(false);
    setPending(null);
    router.push(`/${subdomain}/${clientSlug}/cart`);
  }, [router, subdomain, clientSlug]);

  const handleCloseModal = useCallback(() => {
    if (modalLoading) return;
    setModalOpen(false);
    setPending(null);
  }, [modalLoading]);

  const CartDuplicateModal = useCallback(
    () => (
      <CartDuplicateConfirmModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onConfirmAdd={() => void handleConfirmAdd()}
        onGoToCart={handleGoToCart}
        loading={modalLoading}
      />
    ),
    [modalOpen, handleCloseModal, handleConfirmAdd, handleGoToCart, modalLoading]
  );

  return {
    requestAddToCart,
    addingProductId,
    isAdding: addingProductId != null,
    CartDuplicateModal,
  };
}
