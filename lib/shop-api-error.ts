/**
 * 거래처 쇼핑몰 API(JSON) 공통 파싱 — shopFetch 응답 body 처리용
 */

export type RegisteredClientHint = {
  name: string;
  slug: string;
  partnerSubdomain: string;
};

export type ShopApiErrorBody = {
  error?: string;
  /** 프로필 API 403 등에서 소속 거래처 안내용 */
  registeredClient?: RegisteredClientHint | null;
};

export async function parseShopJsonResponse<T>(
  res: Response
): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; body: ShopApiErrorBody }
> {
  const body = (await res.json().catch(() => ({}))) as T & ShopApiErrorBody;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      body: {
        error: typeof body.error === "string" ? body.error : undefined,
        registeredClient:
          body.registeredClient &&
          typeof body.registeredClient === "object" &&
          body.registeredClient !== null
            ? {
                name: String(body.registeredClient.name ?? ""),
                slug: String(body.registeredClient.slug ?? ""),
                partnerSubdomain: String(
                  body.registeredClient.partnerSubdomain ?? ""
                ),
              }
            : body.registeredClient === null
              ? null
              : undefined,
      },
    };
  }
  return { ok: true, data: body as T };
}
