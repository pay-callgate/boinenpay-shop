type Props = {
  onEmailStart: () => void;
};

/** 소셜 아래 · 탭 위 — 이메일(기존 회원) 폼으로 유도 */
export function LoginEmailStartHint({ onEmailStart }: Props) {
  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        onClick={onEmailStart}
        className="text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-[3px] hover:text-slate-700"
      >
        이메일로 시작하기
      </button>
    </div>
  );
}
