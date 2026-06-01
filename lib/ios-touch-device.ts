/** iPhone / iPad / iPod touch (Safari·카카오 IAB 등). Android·PC는 false. */
export function isIosTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iP(hone|ad|od)/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
  );
}
