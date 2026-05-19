"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export type ShopPurchaseBlockReason = "login" | "affiliation" | "needClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reason: ShopPurchaseBlockReason;
  subdomain: string;
  clientSlug: string;
  /** 로그인 후 복귀 URL */
  callbackUrl: string;
  /** 현재 몰 거래처명 */
  shopClientName?: string;
  /** 소속 불일치 시 등록된 거래처명 */
  registeredClientName?: string;
  registeredClientSlug?: string;
  userEmail?: string | null;
}

/**
 * 상품 탐색은 허용하되 장바구니·바로구매 시 로그인/소속 검사용 모달
 */
export function ShopPurchaseBlockModal({
  isOpen,
  onClose,
  reason,
  subdomain,
  clientSlug,
  callbackUrl,
  shopClientName,
  registeredClientName,
  registeredClientSlug,
  userEmail,
}: Props) {
  const router = useRouter();

  if (!isOpen) return null;

  const mallLabel = shopClientName?.trim() || "이 전용몰";
  const regName = registeredClientName?.trim() || "등록된 거래처";

  const goLogin = () => {
    const path = `/${subdomain}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    if (typeof window !== "undefined") {
      window.location.href = `${window.location.origin}${path}`;
    }
  };

  const goRegisteredMall = () => {
    if (registeredClientSlug && subdomain) {
      router.replace(`/${subdomain}/${registeredClientSlug}`);
    } else if (subdomain) {
      router.replace(`/${subdomain}`);
    }
    onClose();
  };

  const handleSwitchAccount = async () => {
    if (typeof window === "undefined" || !subdomain) return;
    const origin = window.location.origin;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    const loginPath = `/${subdomain}/login?callbackUrl=${encodeURIComponent(returnTo)}`;
    try {
      await signOut({ redirect: false });
    } catch {
      // ignore
    }
    window.location.replace(`${origin}${loginPath}`);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-purchase-block-title"
    >
      <div className="max-h-[90vh] w-full max-w-[360px] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {reason === "login" && (
          <>
            <h2 id="shop-purchase-block-title" className="text-lg font-bold text-gray-900">
              로그인이 필요합니다
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              장바구니 담기·바로구매는 로그인 후 이용할 수 있습니다.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={goLogin}
                className="w-full rounded-xl py-3.5 text-base font-semibold text-white"
                style={{ backgroundColor: "#D6A8E0" }}
              >
                로그인하기
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border-2 border-[#D6A8E0] bg-white py-3.5 text-base font-semibold text-[#5B21B6]"
              >
                닫기
              </button>
            </div>
          </>
        )}

        {reason === "needClient" && (
          <>
            <h2 id="shop-purchase-block-title" className="text-lg font-bold text-gray-900">
              소속 기업 등록이 필요합니다
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              {mallLabel}에서 구매하시려면 먼저 소속 기업을 등록해 주세요. 마이페이지에서 소속 기업 찾기를 진행한 뒤 다시 시도해 주세요.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/${subdomain}/${clientSlug}/mypage`);
                }}
                className="w-full rounded-xl py-3.5 text-base font-semibold text-white"
                style={{ backgroundColor: "#D6A8E0" }}
              >
                마이페이지로 이동
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border-2 border-[#D6A8E0] bg-white py-3.5 text-base font-semibold text-[#5B21B6]"
              >
                닫기
              </button>
            </div>
          </>
        )}

        {reason === "affiliation" && (
          <>
            <h2 id="shop-purchase-block-title" className="text-lg font-bold text-gray-900">
              이 전용몰에서는 구매할 수 없습니다
            </h2>
            <p
              className="mt-3 text-sm leading-relaxed text-gray-600"
              style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}
            >
              {userEmail ? (
                <>
                  현재 로그인된 계정(
                  <span className="break-all">{userEmail}</span>)은
                  <br />
                  <strong className="text-gray-900">{regName}</strong> 소속 회원입니다.
                  <br />
                  <br />
                </>
              ) : (
                <>
                  현재 로그인된 계정은 확인할 수 없습니다. 이 계정은
                  <br />
                  <strong className="text-gray-900">{regName}</strong> 소속 회원으로 등록되어 있습니다.
                  <br />
                  <br />
                </>
              )}
              현재 접속하신 <strong className="text-gray-900">{mallLabel}</strong> 몰의
              <br />
              서비스 이용이 제한됩니다.
              <br />
              <br />
              소속 전용몰로 이동하시거나,
              <br />
              다른 계정으로 로그인해 주세요.
            </p>
            <div className="mt-10 flex flex-col gap-2">
              <button
                type="button"
                onClick={goRegisteredMall}
                className="w-full rounded-xl py-3.5 text-base font-semibold text-white"
                style={{ backgroundColor: "#D6A8E0", wordBreak: "keep-all", lineHeight: 1.35 }}
              >
                내 소속 전용몰로 이동
              </button>
              <button
                type="button"
                onClick={() => void handleSwitchAccount()}
                className="w-full rounded-xl border-2 border-[#D6A8E0] bg-white py-3.5 text-base font-semibold text-[#5B21B6]"
                style={{ wordBreak: "keep-all", lineHeight: 1.35 }}
              >
                다른 계정으로 로그인
              </button>
              <button type="button" onClick={onClose} className="w-full py-2 text-sm text-gray-500 underline">
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
