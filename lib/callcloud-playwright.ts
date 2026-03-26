/**
 * CallCloud 070 연동 - Playwright Core + 원격 브라우저 (Browserless 등) 또는 로컬 Chrome
 *
 * 프로덕션(Vercel): 환경 변수 BROWSERLESS_WS_ENDPOINT (wss://...) 로 chromium.connect
 * 로컬 개발: WS 미설정 시 시스템 Chrome 채널 실행 (playwright-core, 브라우저 바이너리 미포함)
 *   - 선택: CALLCLOUD_CHROME_EXECUTABLE 로 Chromium/Chrome 경로 지정 (Linux 등)
 *
 * 플로우: 등록 여부 사전 검색 → 분기(기존 수정 OR 신규 등록)
 * Vuetify(Vue.js) 기반이므로 동적 id 미사용.
 */

import {
  chromium,
  type Browser,
  type BrowserType,
  type Page,
  type Locator,
} from "playwright-core";

export interface CallCloudRegisterInput {
  clientName: string;
  call070Number: string;
  greetingMessage: string;
  industry: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  serviceUrl: string;
  smsText: string;
}

export interface CallCloudAutomationResult {
  success: boolean;
  message?: string;
  error?: string;
}

const BASE_URL = "https://backoffice.callcloud.kr:27091";
const LOGIN_URL = `${BASE_URL}/login`;
const COMPANY_URL = `${BASE_URL}/company`;
const DEFAULT_TIMEOUT_MS = 20000;
const UI_WAIT_TIMEOUT_MS = 10000;

/** Browserless WebSocket 연결 타임아웃 */
const REMOTE_BROWSER_CONNECT_TIMEOUT_MS = 60000;
/** 로컬 launch 타임아웃 */
const LOCAL_BROWSER_LAUNCH_TIMEOUT_MS = 30000;

function formatAutomationError(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : String(caught ?? "");
  if (raw.includes("has been closed")) {
    return "브라우저가 종료되었거나 연결이 끊어졌습니다. (창을 닫지 말고 다시 시도해 주세요.)";
  }
  return raw || "알 수 없는 오류입니다.";
}

function getHeadless(): boolean {
  const v = process.env.CALLCLOUD_HEADLESS;
  return v === "true" || v === "1";
}

function isProductionLikeRuntime(): boolean {
  return (
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
  );
}

/**
 * 원격(Browserless) 연결 또는 로컬 Chrome 실행.
 * @throws Error 연결 실패·설정 누락 시 명시적 메시지
 */
async function acquireCallCloudBrowser(headless: boolean): Promise<Browser> {
  const wsEndpoint = process.env.BROWSERLESS_WS_ENDPOINT?.trim();

  if (wsEndpoint) {
    try {
      console.log(
        "[CallCloud] Browserless(원격) chromium.connect 시도… (타임아웃 %dms)",
        REMOTE_BROWSER_CONNECT_TIMEOUT_MS
      );
      const browser = await chromium.connect(wsEndpoint, {
        timeout: REMOTE_BROWSER_CONNECT_TIMEOUT_MS,
      });
      console.log("[CallCloud] 원격 브라우저 연결 성공.");
      return browser;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error("[CallCloud] 원격 브라우저 연결 실패:", raw);
      throw new Error(
        `Browserless 원격 브라우저 연결에 실패했습니다. BROWSERLESS_WS_ENDPOINT(URL·토큰)·방화벽을 확인해 주세요. 원본: ${raw}`
      );
    }
  }

  if (isProductionLikeRuntime()) {
    throw new Error(
      "프로덕션 환경에서는 BROWSERLESS_WS_ENDPOINT가 필요합니다. Vercel 환경 변수에 Browserless WebSocket URL(wss://…)을 설정해 주세요."
    );
  }

  const executablePath = process.env.CALLCLOUD_CHROME_EXECUTABLE?.trim();
  const launchOptions: Parameters<BrowserType["launch"]>[0] = {
    headless,
    timeout: LOCAL_BROWSER_LAUNCH_TIMEOUT_MS,
    args: [
      "--ignore-certificate-errors",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      ...(headless ? [] : ["--start-maximized"]),
    ],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  } else {
    launchOptions.channel = "chrome";
  }

  try {
    console.log(
      "[CallCloud] 로컬 Chrome launch (playwright-core, WS 미설정 폴백)…"
    );
    const browser = await chromium.launch(launchOptions);
    console.log("[CallCloud] 로컬 브라우저 실행 성공.");
    return browser;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[CallCloud] 로컬 브라우저 실행 실패:", raw);
    throw new Error(
      `로컬 Chrome 실행에 실패했습니다. Google Chrome 설치 또는 CALLCLOUD_CHROME_EXECUTABLE 로 실행 파일 경로를 지정하세요. 원본: ${raw}`
    );
  }
}

/** 070 번호 정규화 (하이픈 제거, 검색/입력용) */
function normalize070(num: string): string {
  return (num || "").replace(/\D/g, "");
}

const FORM_WAIT_MS = 5000;
const VUETIFY_BLUR_DELAY_MS = 200;
const SUBMIT_WAIT_AFTER_CLICK_MS = 3000;
const NETWORK_IDLE_TIMEOUT_MS = 10000;
const REDIRECT_WAIT_MS = 5000;

/**
 * Vue/Vuetify 입력: 사람처럼 키보드로 한 글자씩 입력해 v-model 동기화 강제 유발
 */
async function fillVuetifyInput(
  page: Page,
  inputLocator: Locator,
  value: string
): Promise<void> {
  await inputLocator.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await inputLocator.pressSequentially(value, { delay: 20 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(VUETIFY_BLUR_DELAY_MS);
}

/**
 * Grid 레이아웃: 라벨(col-2)과 입력(col-10)이 형제
 */
function getField(
  page: Page,
  labelText: string,
  tag: "input" | "textarea" = "input"
): Locator {
  return page
    .locator(
      `xpath=//div[contains(@class, "col-2") and contains(., "${labelText}")]/following-sibling::div[1]//${tag}`
    )
    .first();
}

/**
 * 신규 등록/상세 수정 폼 입력
 */
async function fillCompanyForm(
  page: Page,
  input: CallCloudRegisterInput
): Promise<void> {
  const repNumber = normalize070(input.call070Number);
  const adminPhoneNorm = normalize070(input.adminPhone);

  console.log("[CallCloud] 폼 필드(고객사명) 대기 중...");
  await getField(page, "고객사명").waitFor({ state: "visible", timeout: 15000 });

  console.log("[CallCloud] 고객사명 입력 중...");
  await fillVuetifyInput(page, getField(page, "고객사명"), input.clientName);
  console.log("[CallCloud] 고객사명 입력 완료.");

  console.log("[CallCloud] 인사말 멘트 입력 중...");
  await fillVuetifyInput(page, getField(page, "인사말 멘트"), input.greetingMessage);
  console.log("[CallCloud] 인사말 멘트 입력 완료.");

  console.log("[CallCloud] 고객사 대표번호 입력 중...");
  await fillVuetifyInput(page, getField(page, "고객사 대표번호"), repNumber);
  console.log("[CallCloud] 고객사 대표번호 입력 완료.");

  console.log("[CallCloud] 관리자명 입력 중...");
  await fillVuetifyInput(page, getField(page, "관리자명"), input.adminName);
  console.log("[CallCloud] 관리자명 입력 완료.");

  console.log("[CallCloud] 관리자 이메일 입력 중...");
  await fillVuetifyInput(page, getField(page, "관리자 이메일"), input.adminEmail);
  console.log("[CallCloud] 관리자 이메일 입력 완료.");

  console.log("[CallCloud] 관리자 전화번호 입력 중...");
  await fillVuetifyInput(page, getField(page, "관리자 전화번호"), adminPhoneNorm);
  console.log("[CallCloud] 관리자 전화번호 입력 완료.");

  console.log("[CallCloud] 서비스 URL 입력 중...");
  await fillVuetifyInput(page, getField(page, "서비스 URL"), input.serviceUrl);
  console.log("[CallCloud] 서비스 URL 입력 완료.");

  console.log("[CallCloud] SMS 텍스트 입력 중...");
  await fillVuetifyInput(
    page,
    getField(page, "SMS 텍스트", "textarea"),
    input.smsText
  );
  console.log("[CallCloud] SMS 텍스트 입력 완료.");

  console.log("[CallCloud] 업종 드롭다운 탐색 및 클릭 시도...");
  const industrySelect = page
    .locator(
      'xpath=//div[contains(@class, "col-2") and contains(., "업종")]/following-sibling::div[1]//div[contains(@class, "v-select")]'
    )
    .first();

  if (await industrySelect.isVisible().catch(() => false)) {
    console.log("[CallCloud] 업종 드롭다운 클릭...");
    await industrySelect.click();
    await page
      .waitForSelector(".v-list-item__title", { state: "visible", timeout: 5000 });

    const industryItem = page
      .locator(".v-list-item__title")
      .filter({ hasText: /^쇼핑몰$/ })
      .first();
    if (await industryItem.isVisible().catch(() => false)) {
      await industryItem.click({ force: true });
      console.log("[CallCloud] 업종 선택 완료: 쇼핑몰");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    console.log("[CallCloud] 업종 드롭다운 요소를 찾지 못해 건너뜁니다.");
  }
}

async function ensureServiceStatus(page: Page): Promise<void> {
  console.log("[CallCloud] 서비스 상태 '서비스' 선택 시도...");
  const serviceRadioLabel = page
    .locator(
      'xpath=//div[contains(@class, "col-2") and contains(., "서비스 상태")]/following-sibling::div[1]//label[text()="서비스"]'
    )
    .first();

  if (await serviceRadioLabel.isVisible().catch(() => false)) {
    await serviceRadioLabel.click({ force: true });
    console.log("[CallCloud] 서비스 상태 '서비스' 선택 완료.");
  } else {
    console.log("[CallCloud] '서비스' 라디오 버튼을 찾지 못했습니다.");
  }
}

/**
 * 등록 여부 검색 → 분기(수정 / 신규) 처리
 */
export async function runCallCloudRegister(
  input: CallCloudRegisterInput
): Promise<CallCloudAutomationResult> {
  const loginId = process.env.CALLCLOUD_ID || "sh.lee";
  const loginPwd = process.env.CALLCLOUD_PWD || "callgate";
  const headless = getHeadless();
  let browser: Browser | null = null;

  try {
    browser = await acquireCallCloudBrowser(headless);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err ?? "브라우저 초기화 실패");
    console.error("[CallCloud] acquireCallCloudBrowser:", message);
    return { success: false, error: message };
  }

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: null,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

    page.on("dialog", async (dialog) => {
      console.log(`[CallCloud] 알림창 감지 및 자동 확인: ${dialog.message()}`);
      try {
        await dialog.accept();
      } catch (e) {
        console.warn("[CallCloud] dialog.accept 실패:", e);
      }
    });

    try {
      console.log("[CallCloud] 1. 로그인 페이지 접속 중...");
      await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 30000 });
      console.log("[CallCloud] 1. 로그인 페이지 로드 완료.");
    } catch (e) {
      console.error("[CallCloud] 1. 로그인 페이지 접속 실패:", e);
      throw e;
    }

    try {
      console.log("[CallCloud] 2. ID 입력 중...");
      await page.locator('input[type="text"]').first().fill(loginId);
      console.log("[CallCloud] 2. ID 입력 완료.");
    } catch (e) {
      console.error("[CallCloud] 2. ID 입력 실패:", e);
      throw e;
    }

    try {
      console.log("[CallCloud] 3. 비밀번호 입력 중...");
      await page.locator('input[type="password"]').fill(loginPwd);
      console.log("[CallCloud] 3. 비밀번호 입력 완료.");
    } catch (e) {
      console.error("[CallCloud] 3. 비밀번호 입력 실패:", e);
      throw e;
    }

    try {
      console.log("[CallCloud] 4. LOGIN 버튼 클릭...");
      await page.locator(".v-btn", { hasText: "LOGIN" }).click();
      console.log("[CallCloud] 4. LOGIN 버튼 클릭 완료.");
    } catch (e) {
      console.error("[CallCloud] 4. LOGIN 클릭 실패:", e);
      throw e;
    }

    try {
      console.log("[CallCloud] 5. 로그인 완료 대기...");
      await page.waitForURL(/\/company/, { timeout: 10000 });
      console.log("[CallCloud] 5. 메인 화면 진입 완료.");
    } catch (e) {
      console.error("[CallCloud] 5. /company 미진입:", e);
      throw e;
    }

    try {
      await page.goto(COMPANY_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page
        .locator(".v-btn", { hasText: "신규고객사 등록" })
        .waitFor({ state: "visible", timeout: UI_WAIT_TIMEOUT_MS })
        .catch(() => null);
    } catch (e) {
      console.error("[CallCloud] 6. 고객사 목록 대기 실패:", e);
      throw e;
    }

    await page.locator(".v-select").filter({ hasText: "검색어: 고객사명" }).first().click();
    await page
      .locator(".v-menu__content.menuable__content__active")
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => null);
    await page
      .locator(".v-list-item, .v-list-item__title")
      .filter({ hasText: "서비스번호" })
      .first()
      .click({ timeout: 5000 })
      .catch(() => null);

    const searchValue = normalize070(input.call070Number);
    await page.getByPlaceholder("검색어를 입력해주세요").fill(searchValue);
    await page.locator(".v-btn", { hasText: "검색" }).click();
    await page.locator("tbody").waitFor({ state: "visible", timeout: UI_WAIT_TIMEOUT_MS });
    console.log("[CallCloud] 검색어 입력...");

    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    const searchNumFormatted = searchValue.replace(
      /(\d{3})(\d{4})(\d{4})/,
      "$1-$2-$3"
    );
    let matchingRowIndex = -1;
    for (let i = 0; i < rowCount; i++) {
      const text = await rows.nth(i).innerText().catch(() => "");
      if (
        text.includes(searchValue) ||
        text.includes(searchNumFormatted) ||
        text.includes(input.call070Number)
      ) {
        matchingRowIndex = i;
        break;
      }
      console.log("[CallCloud] 테이블에서 해당 070번호 찾기...");
    }
    const foundRow = matchingRowIndex >= 0;

    if (foundRow) {
      console.log("[CallCloud] 기등록 행 클릭, 상세 페이지 진입...");
      await rows.nth(matchingRowIndex).click();
      await page.waitForURL(/\/company\/[^/]+\/detail/, { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(2000).catch(() => null);

      console.log("[CallCloud] 기등록 070번호의 세부 정보 업데이트 시작...");
      await fillCompanyForm(page, input);
      await ensureServiceStatus(page);

      console.log("[CallCloud] 마지막 입력값 Vue 상태 동기화 대기...");
      await page.waitForTimeout(1000);

      const submitEditBtn = page.locator("button.green").filter({ hasText: "수정" }).first();
      await submitEditBtn.waitFor({ state: "visible", timeout: 5000 });
      await submitEditBtn.scrollIntoViewIfNeeded().catch(() => null);

      console.log("[CallCloud] 수정 버튼 클릭 시퀀스...");
      await submitEditBtn.hover();
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.up();

      await page.waitForTimeout(2000);
      console.log("[CallCloud] 수정 버튼 클릭 시퀀스 완료.");

      await page.waitForTimeout(SUBMIT_WAIT_AFTER_CLICK_MS);
      await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {
        console.log("[CallCloud] 네트워크 유휴 대기 타임아웃 (무시하고 진행)");
      });
      await page.waitForURL(/\/company/, { timeout: REDIRECT_WAIT_MS }).catch(() => null);
      await page
        .locator(".v-btn", { hasText: "신규고객사 등록" })
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => null);
    } else {
      console.log("[CallCloud] 신규고객사 등록 클릭...");
      await page.locator(".v-btn", { hasText: "신규고객사 등록" }).click();
      await page.waitForURL(/\/company\/new/, { timeout: 10000 });
      await page.waitForSelector(".v-text-field__slot input[type='text']", {
        state: "visible",
        timeout: FORM_WAIT_MS,
      });

      await fillCompanyForm(page, input);
      await ensureServiceStatus(page);

      console.log("[CallCloud] 등록 버튼 클릭...");
      const registerBtn = page
        .locator(".v-btn")
        .filter({ has: page.locator(".v-btn__content", { hasText: "등록" }) })
        .first();
      await registerBtn.waitFor({ state: "visible", timeout: FORM_WAIT_MS });
      await registerBtn.scrollIntoViewIfNeeded().catch(() => null);
      await registerBtn.click({ timeout: 25000 });
      console.log("[CallCloud] 등록 버튼 클릭 완료.");

      await page.waitForTimeout(SUBMIT_WAIT_AFTER_CLICK_MS);
      await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {
        console.log("[CallCloud] 네트워크 유휴 대기 타임아웃 (무시하고 진행)");
      });
      await page.waitForURL(/\/company/, { timeout: REDIRECT_WAIT_MS }).catch(() => null);
      await page
        .locator(".v-btn", { hasText: "신규고객사 등록" })
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => null);
    }

    try {
      await context.close();
    } catch (e) {
      console.warn("[CallCloud] context.close:", e);
    }

    return {
      success: true,
      message: foundRow
        ? "CallCloud 고객사 정보가 수정되었습니다."
        : "CallCloud 신규 고객사 등록이 완료되었습니다.",
    };
  } catch (caught: unknown) {
    const message = formatAutomationError(caught);
    console.error("CallCloud Playwright error:", message);
    return { success: false, error: message };
  } finally {
    if (browser) {
      const keepOpen =
        process.env.CALLCLOUD_KEEP_BROWSER_OPEN !== "false" && !getHeadless();
      if (!keepOpen) {
        try {
          await browser.close();
        } catch (e) {
          console.error("[CallCloud] browser.close error:", e);
        }
      } else {
        console.log(
          "[CallCloud] 브라우저 연결 유지 (CALLCLOUD_KEEP_BROWSER_OPEN, 비-headless)"
        );
      }
    }
  }
}
