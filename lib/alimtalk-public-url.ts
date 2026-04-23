/**
 * 카카오 알림톡 본문 URL: localhost 는 클라이언트에서 링크(파란 밑줄)로 처리되지 않음.
 * 로컬·스테이징 테스트 시 공개 origin 으로 치환해 발송한다.
 */

const LOCAL_DEV_ORIGIN_RE_GLOBAL =
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/gi;
const LOCAL_DEV_ORIGIN_RE_TEST =
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/i;

export function alimtalkMessageContainsLocalDevUrl(text: string): boolean {
  return LOCAL_DEV_ORIGIN_RE_TEST.test(text);
}

/**
 * ALIMTALK_PUBLIC_ORIGIN 우선, 없으면 NEXT_PUBLIC_APP_URL 이 localhost 가 아닐 때만 사용.
 */
export function getAlimtalkPublicOriginForRewrite(): string | null {
  const explicit = process.env.ALIMTALK_PUBLIC_ORIGIN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!app) return null;
  const normalized = app.replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1|\[::1\]/i.test(normalized)) return null;
  return normalized;
}

/** localhost/127.0.0.1/[::1] origin 만 공개 origin 으로 교체(경로·쿼리 유지) */
export function rewriteLocalDevUrlsForAlimtalk(text: string, publicOrigin: string): string {
  const base = publicOrigin.replace(/\/$/, "");
  return text.replace(LOCAL_DEV_ORIGIN_RE_GLOBAL, base);
}

export type PrepareAlimtalkMessageResult =
  | { ok: true; msg: string; rewritten: boolean }
  | { ok: false; error: string };

/**
 * 발송 직전 메시지 정리. localhost URL 이 있는데 치환용 공개 origin 이 없으면 실패.
 */
export function prepareAlimtalkLinkMessage(rawMsg: string): PrepareAlimtalkMessageResult {
  const t = rawMsg.trim();
  if (!t) return { ok: false, error: "메시지가 비었습니다." };

  if (!alimtalkMessageContainsLocalDevUrl(t)) {
    return { ok: true, msg: t.slice(0, 1000), rewritten: false };
  }

  const origin = getAlimtalkPublicOriginForRewrite();
  if (!origin) {
    return {
      ok: false,
      error:
        "메시지에 localhost(또는 127.0.0.1) 주소가 있습니다. 카카오톡에서 링크로 열리려면 공개 HTTPS 주소가 필요합니다. .env에 ALIMTALK_PUBLIC_ORIGIN=https://(ngrok 등 실제 접속 가능한 주소) 를 설정한 뒤 다시 발송해 주세요.",
    };
  }

  const rewritten = rewriteLocalDevUrlsForAlimtalk(t, origin);
  return { ok: true, msg: rewritten.slice(0, 1000), rewritten: true };
}
