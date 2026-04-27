import type { FormEvent } from "react";

type Props = {
  clientSlugForGuest: string | null;
  guestName: string;
  guestOrderNo: string;
  guestPw: string;
  guestSubmitting: boolean;
  guestError: string | null;
  onGuestNameChange: (v: string) => void;
  onGuestOrderNoChange: (v: string) => void;
  onGuestPwChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export function GuestOrderLookupForm({
  clientSlugForGuest,
  guestName,
  guestOrderNo,
  guestPw,
  guestSubmitting,
  guestError,
  onGuestNameChange,
  onGuestOrderNoChange,
  onGuestPwChange,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      {!clientSlugForGuest && (
        <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
          주문하신 거래처 쇼핑몰 화면에서 로그인 메뉴로 들어오시면 비회원 조회를 이용할 수 있습니다.
        </p>
      )}
      <div className="rounded-lg bg-sky-50/60 px-3 pt-2 pb-1 border-b border-slate-200/80">
        <label htmlFor="guest-name" className="text-xs font-medium text-slate-500">
          주문자명
        </label>
        <input
          id="guest-name"
          type="text"
          value={guestName}
          onChange={(e) => onGuestNameChange(e.target.value)}
          className="mt-1 w-full bg-transparent py-2 text-sm text-slate-900 outline-none"
          required
        />
      </div>
      <div className="rounded-lg bg-sky-50/60 px-3 pt-2 pb-1 border-b border-slate-200/80">
        <label htmlFor="guest-order-no" className="text-xs font-medium text-slate-500">
          주문번호
        </label>
        <input
          id="guest-order-no"
          type="text"
          placeholder="- 포함 입력 가능"
          value={guestOrderNo}
          onChange={(e) => onGuestOrderNoChange(e.target.value)}
          className="mt-1 w-full bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          required
        />
      </div>
      <div className="rounded-lg bg-sky-50/60 px-3 pt-2 pb-1 border-b border-slate-200/80">
        <label htmlFor="guest-pw" className="text-xs font-medium text-slate-500">
          비회원 비밀번호
        </label>
        <input
          id="guest-pw"
          type="password"
          value={guestPw}
          onChange={(e) => onGuestPwChange(e.target.value)}
          className="mt-1 w-full bg-transparent py-2 text-sm text-slate-900 outline-none"
          required
        />
      </div>
      {guestError && (
        <p className="text-sm text-rose-600" role="alert">
          {guestError}
        </p>
      )}
      <button
        type="submit"
        disabled={guestSubmitting || !clientSlugForGuest}
        className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50"
      >
        {guestSubmitting ? "조회 중…" : "주문 조회"}
      </button>
    </form>
  );
}
