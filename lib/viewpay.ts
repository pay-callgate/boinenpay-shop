/**
 * ViewPay GW API 연동 유틸 (Phase A)
 * - 액세스 토큰 발급 (get-application-token)
 * - API 호출 시 토큰 포함 (Bearer + X-MERCHANT-ID)
 * - startpay 요청 Body 빌더 (연동규격 + 샘플 검증 형식)
 *
 * 참조: ViewPay 연동규격서, 샘플 my-shopping-mall (paymentController, viewpayApi.js)
 *
 * 환경 변수: 요청 시점에 process.env에서 읽음 (.env.local 로드 검증용).
 * VIEWPAY_APP_KEY에 =, + 등 특수문자 포함 시 .env.local에서 값을 큰따옴표로 감싸는 것을 권장.
 */

/** 랜딩 URL (tid+token만 올 때 우리가 조합) */
export const VIEWPAY_LANDING_PATH = "/v1/web/landing";

let cachedToken: string | null = null;

/**
 * ViewPay 환경 변수를 런타임에 process.env에서 읽음.
 * .env.local이 제대로 로드되는지 진단 로그 출력.
 */
export function getViewPayEnv(): {
  base: string;
  merchantId: string;
  channelId: string;
  appId: string;
  appKey: string;
} {
  const base = (process.env.VIEWPAY_API_BASE_URL ?? "").trim() || "https://stgvl.boinenpay.com";
  const merchantId = (process.env.VIEWPAY_MERCHANT_ID ?? "").trim();
  const channelId = (process.env.VIEWPAY_CHANNEL_ID ?? "").trim();
  const appId = (process.env.VIEWPAY_APP_ID ?? "").trim();
  const appKey = (process.env.VIEWPAY_APP_KEY ?? "").trim();

  console.debug("[ViewPay:Env] 환경 변수 로드", {
    VIEWPAY_API_BASE_URL: base ? `${base.slice(0, 24)}...` : "(기본값)",
    VIEWPAY_MERCHANT_ID: merchantId ? `${merchantId.slice(0, 4)}...` : "(없음)",
    VIEWPAY_CHANNEL_ID: channelId || "(없음)",
    VIEWPAY_APP_ID: appId ? `길이=${appId.length}, 앞4자=${appId.slice(0, 4)}...` : "(없음)",
    VIEWPAY_APP_KEY: appKey ? `길이=${appKey.length}, 앞2자=${appKey.slice(0, 2)}..., 끝1자=${appKey.slice(-1)}` : "(없음)",
  });

  return { base, merchantId, channelId, appId, appKey };
}

/**
 * 액세스 토큰 발급 (POST /v1/gw/get-application-token)
 * 연동규격: Body에 applicationId, applicationKey 만 필수.
 * 토큰 위치: response.accessToken
 * 환경 변수는 호출 시점에 process.env에서 읽음.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken) {
    console.debug("[ViewPay:Token] 사용 중인 캐시 토큰 있음, 재발급 생략");
    return cachedToken;
  }

  const { base, merchantId, appId, appKey } = getViewPayEnv();

  if (!appId || !appKey) {
    console.debug("[ViewPay:Token] APP_ID 또는 APP_KEY 미설정", {
      appIdLength: appId.length,
      appKeyLength: appKey.length,
      envKeys: typeof process.env !== "undefined" ? Object.keys(process.env).filter((k) => k.startsWith("VIEWPAY_")) : [],
    });
    throw new Error(
      "ViewPay 환경 변수 미설정: VIEWPAY_APP_ID, VIEWPAY_APP_KEY를 .env.local에 설정하세요. 값에 =, + 가 있으면 큰따옴표로 감싸세요."
    );
  }

  const url = `${base}/v1/gw/get-application-token`;
  const body = JSON.stringify({
    applicationId: appId,
    applicationKey: appKey,
  });

  console.debug("[ViewPay:Token] 토큰 발급 요청", {
    url,
    applicationId: `${appId.slice(0, 8)}...`,
    merchantId: merchantId || "(없음)",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-MERCHANT-ID": merchantId,
    },
    body,
  });

  const data = (await res.json().catch((e) => {
    console.debug("[ViewPay:Token] 응답 JSON 파싱 실패", e);
    return {};
  })) as {
    result?: { code?: string; message?: string };
    response?: { accessToken?: string };
    token?: string;
    accessToken?: string;
    message?: string;
    code?: string;
  };

  console.debug("[ViewPay:Token] 토큰 발급 응답", {
    status: res.status,
    resultCode: data?.result?.code,
    resultMessage: data?.result?.message,
    hasResponseAccessToken: Boolean(data?.response?.accessToken),
    hasToken: Boolean(data?.token),
    hasAccessToken: Boolean(data?.accessToken),
    rawKeys: data ? Object.keys(data) : [],
  });

  const resultCode = data?.result?.code;
  if (res.status !== 200) {
    const code = data?.code ?? res.status;
    const msg = data?.result?.message ?? data?.message ?? "토큰 발급 실패";
    console.debug("[ViewPay:Token] 토큰 발급 실패 (HTTP)", { status: res.status, code, message: msg, fullResponse: data });
    if (String(code) === "4001") {
      throw new Error(
        "[4001] 이미 발급된 ID/KEY가 존재합니다. 동일 가맹점/어플리케이션 정보를 다른 서버나 환경에서 사용 중이면 이 오류가 납니다."
      );
    }
    throw new Error(`토큰 발급 실패 [${code}]: ${msg}`);
  }

  if (resultCode && resultCode !== "0000") {
    const msg = data?.result?.message ?? data?.message ?? "토큰 발급 실패";
    console.debug("[ViewPay:Token] 토큰 발급 실패 (result.code)", { resultCode, message: msg, fullResponse: data });
    throw new Error(`토큰 발급 실패 [${resultCode}]: ${msg}`);
  }

  const token =
    data?.response?.accessToken ??
    data?.token ??
    data?.accessToken;

  if (!token) {
    console.debug("[ViewPay:Token] 토큰 발급 실패(응답에 token 없음)", { fullResponse: data });
    throw new Error(
      data?.message ?? "토큰 발급 실패(응답에 token 없음). ViewPay 연동규격서 [액세스 토큰 발급] 응답 예시를 확인하세요."
    );
  }

  cachedToken = token;
  console.debug("[ViewPay:Token] 토큰 발급 성공");
  return cachedToken;
}

/**
 * ViewPay API 공통 POST (토큰 자동 포함)
 */
export async function viewpayPost(path: string, body: object): Promise<Record<string, unknown>> {
  console.debug("[ViewPay:API] POST", { path, bodyKeys: Object.keys(body as Record<string, unknown>) });
  const { base, merchantId } = getViewPayEnv();
  const token = await getAccessToken();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-MERCHANT-ID": merchantId,
    },
    body: JSON.stringify(body),
  });

  const resData = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const result = resData?.result as { code?: string; message?: string } | undefined;
  const resultCode = result?.code ?? (resData?.code as string | undefined);

  console.debug("[ViewPay:API] POST 응답", { path, status: res.status, resultCode });

  if (res.status !== 200) {
    const err = new Error(
      (result?.message as string) ?? (resData?.message as string) ?? `HTTP ${res.status}`
    ) as Error & { response?: { status: number; data: unknown } };
    err.response = { status: res.status, data: resData };
    throw err;
  }

  return resData;
}

/**
 * 토큰 캐시 초기화 (401 등 만료 시 재발급용)
 */
export function clearViewpayTokenCache(): void {
  cachedToken = null;
}

/** startpay Body 빌더용 파라미터 (로그인 유저 기준: buyrName, buyrTel, buyrMail 은 호출부에서 세션/주문자 정보로 채움) */
export interface ViewpayStartpayParams {
  orderId: string;
  orderNo: string;
  amount: number;
  taxfreeAmount?: number;
  taxAmount?: number;
  productName?: string;
  returnUrl: string;
  cancelUrl?: string;
  /** 주문자/구매자 이름 (로그인 유저 또는 주문서 입력값) */
  buyerName: string;
  /** 주문자/구매자 연락처 */
  buyerPhone: string;
  /** 주문자/구매자 이메일 (로그인 유저 email 또는 주문서 입력값) */
  buyerEmail: string;
  /** sendTel (선택, 기본 빈 문자열) */
  sendTel?: string;
  /** ViewPay products.orderNo 전체(원주문번호_8자리). prepare에서 생성·DB 저장 후 전달 */
  merchantOrderNo?: string;
  /** ViewPay metaData (짧은 JSON 권장). 웹훅·추적용 */
  metaData?: string;
}

/** startpay용 가맹점 주문번호: 원 주문번호 + 8자리 접미사 (prepare에서 한 번만 생성) */
export function buildMerchantViewpayOrderNo(baseOrderNo: string): string {
  const suffix = Date.now().toString().slice(-8);
  return `${String(baseOrderNo).trim()}_${suffix}`;
}

/**
 * ViewPay→PG 경로에서 가맹점/중계 DB가 MySQL `utf8`(3바이트)인 경우,
 * 구매자명 등에 이모지(U+10000 이상)가 들어가면 저장 단계에서 실패하고
 * 그 오류 문구가 pay 페이지 `JSON.parse('...')` 안에 끼어 들어가며 스크립트 문법 오류가 날 수 있습니다.
 */
export function stripNonBmpCharsForViewpay(s: string): string {
  if (!s) return s;
  return Array.from(s)
    .filter((ch) => (ch.codePointAt(0) ?? 0) <= 0xffff)
    .join("");
}

/**
 * startpay 요청 Body 생성 (연동가이드 필수값 + 샘플 검증 형식)
 * - pgId: "", items: null, language: "", metaData: ""
 * - messageChannel: "VIEWPAY" (웹 결제창 이동)
 * - orderNo에 타임스탬프 접미사 (merchantOrderNo 미전달 시 즉석 생성)
 * - customer: 로그인 유저 기준 buyrName, buyrTel, buyrMail 사용
 */
export function buildStartpayBody(params: ViewpayStartpayParams): Record<string, unknown> {
  const { base, merchantId, channelId } = getViewPayEnv();
  const {
    orderNo,
    amount,
    taxfreeAmount = 0,
    taxAmount = 0,
    productName = "주문상품",
    returnUrl,
    buyerName,
    buyerPhone,
    buyerEmail,
    sendTel = "",
    merchantOrderNo,
    metaData,
  } = params;

  const orderNoWithTs =
    merchantOrderNo?.trim() ||
    `${String(orderNo).trim()}_${Date.now().toString().slice(-8)}`;

  const cmmd =
    stripNonBmpCharsForViewpay(productName.trim()) || "주문상품";
  const buyr =
    stripNonBmpCharsForViewpay(buyerName.trim()) || "구매자";
  const buyrTelSafe = stripNonBmpCharsForViewpay(buyerPhone.trim());
  const sendTelSafe = stripNonBmpCharsForViewpay(sendTel.trim());
  const buyrMailSafe =
    stripNonBmpCharsForViewpay(buyerEmail.trim()) || "noreply@calllink.com";
  const metaSafe = metaData != null ? stripNonBmpCharsForViewpay(metaData.trim()) : "";

  return {
    products: {
      orderNo: orderNoWithTs,
      cmmdName: cmmd,
    },
    customer: {
      buyrName: buyr,
      buyrTel: buyrTelSafe,
      sendTel: sendTelSafe,
      buyrMail: buyrMailSafe,
    },
    channelId: channelId,
    storeId: merchantId,
    pgId: "",
    messageChannel: "VIEWPAY",
    amount: String(amount),
    taxfreeAmount: String(taxfreeAmount),
    taxAmount: String(taxAmount),
    cardQuota: "2:3:4:5:6:7:8:9:10:11:12",
    currency: "KRW",
    language: "",
    metaData: metaSafe,
    redirectUrl: returnUrl,
    webhookUrl: (process.env.VIEWPAY_WEBHOOK_URL ?? "").trim() || "",
    items: null,
  };
}

/**
 * startpay 응답에서 결제창 이동 URL 추출
 * - redirectUrl 있으면 그대로 반환
 * - 없고 tid, token 있으면 VIEWPAY_BASE + /v1/web/landing?tid=...&token=... 생성
 */
export function getRedirectUrlFromStartpayResponse(data: Record<string, unknown>): string | null {
  const response = data?.response as Record<string, unknown> | undefined;
  const redirectUrl =
    (data?.redirectUrl as string) ?? (response?.redirectUrl as string) ?? null;
  if (redirectUrl) return redirectUrl;

  const tid = (data?.tid ?? response?.tid) as string | undefined;
  const token = (data?.token ?? response?.token) as string | undefined;
  if (tid && token) {
    const { base } = getViewPayEnv();
    return `${base}${VIEWPAY_LANDING_PATH}?tid=${encodeURIComponent(tid)}&token=${encodeURIComponent(token)}`;
  }
  return null;
}

/**
 * startpay 응답 성공 여부
 * - ViewPay 실제 응답: result/response 래퍼 없이 최상위에 redirectUrl 만 반환 (result.code 없음)
 * - 참조: console-analysis.json "startpay_response_구조", 샘플 로그 result.code= undefined
 * - 성공 조건: result.code === '0000' 이거나, result.code 없이 redirectUrl(또는 tid+token) 있으면 성공
 */
export function isStartpaySuccess(data: Record<string, unknown>): boolean {
  const result = data?.result as { code?: string } | undefined;
  const code = result?.code ?? (data?.code as string | undefined);
  if (code === "0000") return true;
  // 실제 ViewPay startpay 성공 시 result 없이 최상위 redirectUrl만 옴
  if (code !== undefined && code !== null && code !== "") return false;
  const redirectUrl = getRedirectUrlFromStartpayResponse(data);
  return redirectUrl != null && redirectUrl.length > 0;
}

/** 하위 호환: 런타임 읽기 값 반환 */
export function getViewPayBase(): string {
  return getViewPayEnv().base;
}

export const VIEWPAY_BASE = process.env.VIEWPAY_API_BASE_URL || "https://stgvl.boinenpay.com";
export const MERCHANT_ID = process.env.VIEWPAY_MERCHANT_ID || "";
export const CHANNEL_ID = process.env.VIEWPAY_CHANNEL_ID || "";
