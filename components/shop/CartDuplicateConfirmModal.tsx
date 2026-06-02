"use client";

const PRIMARY = "#D6A8E0";

type CartDuplicateConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmAdd: () => void;
  onGoToCart: () => void;
  loading?: boolean;
};

/**
 * 장바구니 중복 담기 확인 — ShopPurchaseBlockModal과 동일 톤
 */
export function CartDuplicateConfirmModal({
  isOpen,
  onClose,
  onConfirmAdd,
  onGoToCart,
  loading = false,
}: CartDuplicateConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-duplicate-confirm-title"
    >
      <div className="max-h-[90vh] w-full max-w-[360px] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2
          id="cart-duplicate-confirm-title"
          className="text-center text-lg font-bold leading-snug text-gray-900"
        >
          장바구니 안내
        </h2>
        <p className="mt-4 text-center text-sm leading-relaxed text-gray-600 break-keep">
          이미 장바구니에 담겨있는 상품입니다.
          <br />
          수량을 추가하시겠습니까?
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirmAdd}
            className="w-full rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            수량 추가
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onGoToCart}
            className="w-full rounded-xl border-2 border-[#D6A8E0] bg-white py-3.5 text-base font-semibold text-[#5B21B6] disabled:opacity-60"
          >
            장바구니 보기
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 underline disabled:opacity-60"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
