type Props = {
  onKakao: () => void;
  onNaver: () => void;
  /** 상단 안내 (예: "○○ 임직원 로그인") */
  caption?: string;
};

export function SocialLoginButtons({ onKakao, onNaver, caption }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-medium text-slate-500">
        {caption ?? "카카오·네이버로 간편하게 시작"}
      </p>
      <button
        type="button"
        onClick={onKakao}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 py-3.5 text-sm font-semibold text-[#191919] shadow-sm transition hover:brightness-95 active:scale-[0.99]"
      >
        카카오톡 계정으로 로그인
      </button>
      <button
        type="button"
        onClick={onNaver}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#03C75A] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.99]"
      >
        네이버 계정으로 로그인
      </button>
      <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-400">
        로그인 후 쇼핑몰 주문·배송 조회를 이용할 수 있습니다.
      </p>
    </div>
  );
}
