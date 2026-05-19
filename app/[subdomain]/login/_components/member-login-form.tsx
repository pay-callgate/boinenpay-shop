import type { FormEvent, RefObject } from "react";

type Props = {
  memberIdInputRef?: RefObject<HTMLInputElement | null>;
  memberId: string;
  memberPw: string;
  showPw: boolean;
  memberSubmitting: boolean;
  memberError: string | null;
  onMemberIdChange: (v: string) => void;
  onMemberPwChange: (v: string) => void;
  onTogglePw: () => void;
  onSubmit: (e: FormEvent) => void;
};

export function MemberLoginForm({
  memberIdInputRef,
  memberId,
  memberPw,
  showPw,
  memberSubmitting,
  memberError,
  onMemberIdChange,
  onMemberPwChange,
  onTogglePw,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} autoComplete="off" className="mt-6 space-y-5">
      <div className="rounded-lg bg-sky-50/60 px-3 pt-2 pb-1 border-b border-slate-200/80">
        <label htmlFor="shop-login-id" className="text-xs font-medium text-slate-500">
          아이디
        </label>
        <input
          id="shop-login-id"
          ref={memberIdInputRef}
          name="shop_login_identifier"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="아이디(이메일)를 입력하세요"
          value={memberId}
          onChange={(e) => onMemberIdChange(e.target.value)}
          className="mt-1 w-full bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
      <div className="rounded-lg bg-sky-50/60 px-3 pt-2 pb-1 border-b border-slate-200/80">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="shop-login-pw" className="text-xs font-medium text-slate-500">
            비밀번호
          </label>
          <button
            type="button"
            className="shrink-0 text-xs text-slate-500 hover:text-slate-800"
            onClick={onTogglePw}
          >
            {showPw ? "숨기기" : "표시"}
          </button>
        </div>
        <input
          id="shop-login-pw"
          name="shop_login_password"
          type={showPw ? "text" : "password"}
          autoComplete="off"
          value={memberPw}
          onChange={(e) => onMemberPwChange(e.target.value)}
          className="mt-1 w-full bg-transparent py-2 text-sm text-slate-900 outline-none"
        />
      </div>
      {/*
      TODO: 로그인 상태 유지 기능 적용 시 — autoLogin / onAutoLoginChange props 복구
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={autoLogin}
          onChange={(e) => onAutoLoginChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        로그인 상태 유지
      </label>
      */}
      {memberError && (
        <p className="text-sm text-rose-600" role="alert">
          {memberError}
        </p>
      )}
      <button
        type="submit"
        disabled={memberSubmitting}
        className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50"
      >
        {memberSubmitting ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
