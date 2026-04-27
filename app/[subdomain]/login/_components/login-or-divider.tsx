export function LoginOrDivider() {
  return (
    <div className="relative my-7">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-slate-200/90" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-white px-4 text-slate-400 font-medium tracking-wide">또는</span>
      </div>
    </div>
  );
}
