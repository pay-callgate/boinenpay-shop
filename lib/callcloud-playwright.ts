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

import { randomUUID } from "crypto";
import {
  chromium,
  type Browser,
  type BrowserType,
  type Page,
  type Locator,
} from "playwright-core";

/** 터미널·Vercel 로그 추적용 (요청 단위 runId + 타임스탬프 + 경과 ms) */
export type CallCloudActivityLogger = {
  runId: string;
  info: (
    phase: string,
    message: string,
    extra?: Record<string, unknown>
  ) => void;
  warn: (
    phase: string,
    message: string,
    extra?: Record<string, unknown>
  ) => void;
  error: (
    phase: string,
    message: string,
    extra?: Record<string, unknown>
  ) => void;
};

function createCallCloudActivityLogger(): CallCloudActivityLogger {
  const runId = randomUUID();
  const t0 = Date.now();
  const line = (
    level: "INFO" | "WARN" | "ERROR",
    phase: string,
    message: string,
    extra?: Record<string, unknown>
  ) => {
    const ts = new Date().toISOString();
    const elapsedMs = Date.now() - t0;
    const tail =
      extra && Object.keys(extra).length > 0
        ? ` | ${JSON.stringify(extra)}`
        : "";
    return `[CallCloud][${level}][run=${runId}][${ts}][+${elapsedMs}ms][${phase}] ${message}${tail}`;
  };
  return {
    runId,
    info(p, m, e) {
      console.log(line("INFO", p, m, e));
    },
    warn(p, m, e) {
      console.warn(line("WARN", p, m, e));
    },
    error(p, m, e) {
      console.error(line("ERROR", p, m, e));
    },
  };
}

/** WebSocket URL 로그용(토큰·쿼리 마스킹) */
function maskWsEndpointForLog(ws: string): string {
  try {
    const u = new URL(ws);
    for (const key of [...u.searchParams.keys()]) {
      if (/token|key|secret|password/i.test(key)) {
        u.searchParams.set(key, "(redacted)");
      }
    }
    return `${u.protocol}//${u.host}${u.pathname}${u.search ? u.search : ""}`;
  } catch {
    return "(unparseable BROWSERLESS_WS_ENDPOINT)";
  }
}

/** 로그용 070/전화번호 일부만 노출 */
function maskDigitsForLog(d: string, keepTail = 4): string {
  const digits = (d || "").replace(/\D/g, "");
  if (digits.length <= keepTail) return "(short)";
  return `***${digits.slice(-keepTail)}`;
}

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
async function acquireCallCloudBrowser(
  headless: boolean,
  log: CallCloudActivityLogger
): Promise<Browser> {
  const wsEndpoint = process.env.BROWSERLESS_WS_ENDPOINT?.trim();

  log.info("browser", "브라우저 확보 시작", {
    mode: wsEndpoint ? "remote_connect" : "local_launch",
    headless,
    vercel: process.env.VERCEL ?? "0",
    nodeEnv: process.env.NODE_ENV ?? "(unset)",
    wsEndpointPreview: wsEndpoint ? maskWsEndpointForLog(wsEndpoint) : null,
    connectTimeoutMs: wsEndpoint ? REMOTE_BROWSER_CONNECT_TIMEOUT_MS : null,
    launchTimeoutMs: !wsEndpoint ? LOCAL_BROWSER_LAUNCH_TIMEOUT_MS : null,
  });

  if (wsEndpoint) {
    try {
      log.info(
        "browser.connect",
        `chromium.connect 호출 (timeout=${REMOTE_BROWSER_CONNECT_TIMEOUT_MS}ms)`
      );
      const browser = await chromium.connect(wsEndpoint, {
        timeout: REMOTE_BROWSER_CONNECT_TIMEOUT_MS,
      });
      log.info("browser.connect", "원격 브라우저 연결 성공");
      return browser;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      log.error("browser.connect", "원격 브라우저 연결 실패", {
        message: raw,
        stack: stack ?? null,
      });
      throw new Error(
        `Browserless 원격 브라우저 연결에 실패했습니다. BROWSERLESS_WS_ENDPOINT(URL·토큰)·방화벽을 확인해 주세요. 원본: ${raw}`
      );
    }
  }

  if (isProductionLikeRuntime()) {
    log.error(
      "browser",
      "프로덕션인데 BROWSERLESS_WS_ENDPOINT 없음 — 로컬 launch 시도 안 함"
    );
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
    log.info("browser.launch", "로컬 Chrome launch 시도", {
      channel: executablePath ? undefined : "chrome",
      customExecutable: !!executablePath,
    });
    const browser = await chromium.launch(launchOptions);
    log.info("browser.launch", "로컬 브라우저 실행 성공");
    return browser;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error("browser.launch", "로컬 브라우저 실행 실패", {
      message: raw,
      stack: stack ?? null,
    });
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
  input: CallCloudRegisterInput,
  log: CallCloudActivityLogger
): Promise<void> {
  const repNumber = normalize070(input.call070Number);
  const adminPhoneNorm = normalize070(input.adminPhone);

  log.info("form", "폼: 고객사명 필드 대기(visible 15s)");
  await getField(page, "고객사명").waitFor({ state: "visible", timeout: 15000 });

  log.info("form", "폼: 고객사명 입력", { clientName: input.clientName });
  await fillVuetifyInput(page, getField(page, "고객사명"), input.clientName);
  log.info("form", "폼: 고객사명 입력 완료");

  log.info("form", "폼: 인사말 멘트 입력");
  await fillVuetifyInput(page, getField(page, "인사말 멘트"), input.greetingMessage);
  log.info("form", "폼: 인사말 멘트 완료");

  log.info("form", "폼: 고객사 대표번호 입력", {
    call070: maskDigitsForLog(repNumber),
  });
  await fillVuetifyInput(page, getField(page, "고객사 대표번호"), repNumber);
  log.info("form", "폼: 고객사 대표번호 완료");

  log.info("form", "폼: 관리자명 입력", { hasName: !!input.adminName?.trim() });
  await fillVuetifyInput(page, getField(page, "관리자명"), input.adminName);
  log.info("form", "폼: 관리자명 완료");

  log.info("form", "폼: 관리자 이메일 입력", {
    hasEmail: !!input.adminEmail?.trim(),
  });
  await fillVuetifyInput(page, getField(page, "관리자 이메일"), input.adminEmail);
  log.info("form", "폼: 관리자 이메일 완료");

  log.info("form", "폼: 관리자 전화번호 입력", {
    adminPhone: maskDigitsForLog(adminPhoneNorm),
  });
  await fillVuetifyInput(page, getField(page, "관리자 전화번호"), adminPhoneNorm);
  log.info("form", "폼: 관리자 전화번호 완료");

  log.info("form", "폼: 서비스 URL 입력", { serviceUrl: input.serviceUrl });
  await fillVuetifyInput(page, getField(page, "서비스 URL"), input.serviceUrl);
  log.info("form", "폼: 서비스 URL 완료");

  log.info("form", "폼: SMS 텍스트 입력", {
    smsLength: input.smsText?.length ?? 0,
  });
  await fillVuetifyInput(
    page,
    getField(page, "SMS 텍스트", "textarea"),
    input.smsText
  );
  log.info("form", "폼: SMS 텍스트 완료");

  log.info("form", "폼: 업종 드롭다운 탐색");
  const industrySelect = page
    .locator(
      'xpath=//div[contains(@class, "col-2") and contains(., "업종")]/following-sibling::div[1]//div[contains(@class, "v-select")]'
    )
    .first();

  if (await industrySelect.isVisible().catch(() => false)) {
    log.info("form.industry", "업종 드롭다운 클릭");
    await industrySelect.click();
    // 전역 .v-list-item__title(사이드 메뉴 등)와 충돌하지 않도록, 열린 Vuetify 메뉴 패널 안에서만 탐색
    const openMenu = page
      .locator(".v-menu__content")
      .filter({ has: page.locator(".v-list-item__title") })
      .last();
    await openMenu.waitFor({ state: "visible", timeout: 8000 });

    const industryItem = openMenu
      .locator(".v-list-item__title")
      .filter({ hasText: /^쇼핑몰$/ })
      .first();
    if (await industryItem.isVisible().catch(() => false)) {
      await industryItem.click({ force: true });
      log.info("form.industry", "업종 선택 완료: 쇼핑몰");
    } else {
      log.warn(
        "form.industry",
        "열린 메뉴(.v-menu__content)에서 '쇼핑몰' 항목 미발견"
      );
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    log.warn("form.industry", "업종 드롭다운 미노출 — 건너뜀");
  }
}

async function ensureServiceStatus(
  page: Page,
  log: CallCloudActivityLogger
): Promise<void> {
  log.info("form.serviceStatus", "서비스 상태 라디오 '서비스' 선택 시도");
  const serviceRadioLabel = page
    .locator(
      'xpath=//div[contains(@class, "col-2") and contains(., "서비스 상태")]/following-sibling::div[1]//label[text()="서비스"]'
    )
    .first();

  if (await serviceRadioLabel.isVisible().catch(() => false)) {
    await serviceRadioLabel.click({ force: true });
    log.info("form.serviceStatus", "서비스 상태 '서비스' 선택 완료");
  } else {
    log.warn("form.serviceStatus", "서비스 라디오 미발견");
  }
}

/**
 * 등록 여부 검색 → 분기(수정 / 신규) 처리
 */
export async function runCallCloudRegister(
  input: CallCloudRegisterInput,
  options?: { apiRunId?: string }
): Promise<CallCloudAutomationResult> {
  const log = createCallCloudActivityLogger();
  if (options?.apiRunId) {
    log.info("run.correlation", "API 라우트 runId (동일 요청 추적)", {
      apiRunId: options.apiRunId,
    });
  }
  const loginId = process.env.CALLCLOUD_ID || "sh.lee";
  const loginPwd = process.env.CALLCLOUD_PWD || "callgate";
  const headless = getHeadless();
  let browser: Browser | null = null;

  log.info(
    "run.start",
    "CallCloud 자동화 시작 — 입력 요약(민감값 마스킹)",
    {
      clientName: input.clientName,
      industry: input.industry,
      call070: maskDigitsForLog(normalize070(input.call070Number)),
      adminPhone: maskDigitsForLog(normalize070(input.adminPhone)),
      adminEmailSet: !!input.adminEmail?.trim(),
      adminNameSet: !!input.adminName?.trim(),
      serviceUrl: input.serviceUrl,
      headless,
      loginIdPrefix: loginId.length > 0 ? `${loginId.slice(0, 2)}***` : "(empty)",
      loginPwdSet: !!loginPwd,
      hasBrowserlessWs: !!process.env.BROWSERLESS_WS_ENDPOINT?.trim(),
    }
  );

  try {
    browser = await acquireCallCloudBrowser(headless, log);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err ?? "브라우저 초기화 실패");
    const stack = err instanceof Error ? err.stack : undefined;
    log.error("browser.acquire", "브라우저 확보 단계 실패", {
      message,
      stack: stack ?? null,
    });
    return { success: false, error: message };
  }

  try {
    log.info("context", "browser.newContext + newPage", {
      ignoreHTTPSErrors: true,
      viewport: null,
      defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: null,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

    page.on("dialog", async (dialog) => {
      log.info("page.dialog", "네이티브 다이얼로그 수신 — accept", {
        type: dialog.type(),
        messagePreview: dialog.message().slice(0, 200),
      });
      try {
        await dialog.accept();
      } catch (e) {
        log.warn("page.dialog", "dialog.accept 실패", {
          err: e instanceof Error ? e.message : String(e),
        });
      }
    });

    try {
      log.info("login", "1) LOGIN_URL 이동 networkidle 30s", { url: LOGIN_URL });
      await page.goto(LOGIN_URL, { waitUntil: "networkidle", timeout: 30000 });
      log.info("login", "1) 로그인 페이지 로드 완료", {
        finalUrl: page.url(),
      });
    } catch (e) {
      log.error("login", "1) 로그인 페이지 접속 실패", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
        url: page.url(),
      });
      throw e;
    }

    try {
      log.info("login", "2) ID 입력");
      await page.locator('input[type="text"]').first().fill(loginId);
      log.info("login", "2) ID 입력 완료");
    } catch (e) {
      log.error("login", "2) ID 입력 실패", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
      });
      throw e;
    }

    try {
      log.info("login", "3) 비밀번호 입력 (값 로그 없음)");
      await page.locator('input[type="password"]').fill(loginPwd);
      log.info("login", "3) 비밀번호 입력 완료");
    } catch (e) {
      log.error("login", "3) 비밀번호 입력 실패", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
      });
      throw e;
    }

    try {
      log.info("login", "4) LOGIN 버튼 클릭");
      await page.locator(".v-btn", { hasText: "LOGIN" }).click();
      log.info("login", "4) LOGIN 클릭 완료", { url: page.url() });
    } catch (e) {
      log.error("login", "4) LOGIN 클릭 실패", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
        url: page.url(),
      });
      throw e;
    }

    try {
      log.info("login", "5) URL /company 대기 10s");
      await page.waitForURL(/\/company/, { timeout: 10000 });
      log.info("login", "5) /company 진입 완료", { url: page.url() });
    } catch (e) {
      log.error("login", "5) /company 미진입", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
        currentUrl: page.url(),
      });
      throw e;
    }

    try {
      log.info("company", "6) COMPANY_URL 이동", { url: COMPANY_URL });
      await page.goto(COMPANY_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page
        .locator(".v-btn", { hasText: "신규고객사 등록" })
        .waitFor({ state: "visible", timeout: UI_WAIT_TIMEOUT_MS })
        .catch(() => null);
      log.info("company", "6) 고객사 목록 화면 안정화", { url: page.url() });
    } catch (e) {
      log.error("company", "6) 고객사 목록 대기 실패", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : null,
        url: page.url(),
      });
      throw e;
    }

    log.info("search", "검색 조건: 고객사명 → 서비스번호 전환");
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
    log.info("search", "검색어 입력 및 검색 실행", {
      searchValue: maskDigitsForLog(searchValue),
      rowExpectTimeoutMs: UI_WAIT_TIMEOUT_MS,
    });
    await page.getByPlaceholder("검색어를 입력해주세요").fill(searchValue);
    await page.locator(".v-btn", { hasText: "검색" }).click();
    await page.locator("tbody").waitFor({ state: "visible", timeout: UI_WAIT_TIMEOUT_MS });

    const rows = page.locator("tbody tr");
    const rowCount = await rows.count();
    log.info("search", "검색 결과 테이블 행 수", { rowCount });
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
      log.info("search", "행 스캔 중", { rowIndex: i });
    }
    const foundRow = matchingRowIndex >= 0;
    log.info("branch", "070 매칭 분기", {
      foundRow,
      matchingRowIndex: foundRow ? matchingRowIndex : -1,
    });

    if (foundRow) {
      log.info("branch.edit", "기등록: 행 클릭 → 상세");
      await rows.nth(matchingRowIndex).click();
      await page.waitForURL(/\/company\/[^/]+\/detail/, { timeout: 15000 }).catch(() => null);
      await page.waitForTimeout(2000).catch(() => null);
      log.info("branch.edit", "상세 URL", { url: page.url() });

      await fillCompanyForm(page, input, log);
      await ensureServiceStatus(page, log);

      log.info("branch.edit", "Vue 동기화 1s 대기");
      await page.waitForTimeout(1000);

      const submitEditBtn = page.locator("button.green").filter({ hasText: "수정" }).first();
      await submitEditBtn.waitFor({ state: "visible", timeout: 5000 });
      await submitEditBtn.scrollIntoViewIfNeeded().catch(() => null);

      log.info("branch.edit", "수정 제출 버튼 클릭 시퀀스(hover/mousedown/mouseup)");
      await submitEditBtn.hover();
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.up();

      await page.waitForTimeout(2000);
      log.info("branch.edit", "수정 클릭 시퀀스 완료");

      await page.waitForTimeout(SUBMIT_WAIT_AFTER_CLICK_MS);
      await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {
        log.warn("branch.edit", "networkidle 타임아웃 — 계속 진행");
      });
      await page.waitForURL(/\/company/, { timeout: REDIRECT_WAIT_MS }).catch(() => null);
      await page
        .locator(".v-btn", { hasText: "신규고객사 등록" })
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => null);
      log.info("branch.edit", "수정 플로우 후속 대기 완료", { url: page.url() });
    } else {
      log.info("branch.new", "신규: 신규고객사 등록 클릭");
      await page.locator(".v-btn", { hasText: "신규고객사 등록" }).click();
      await page.waitForURL(/\/company\/new/, { timeout: 10000 });
      log.info("branch.new", "신규 폼 URL", { url: page.url() });
      await page.waitForSelector(".v-text-field__slot input[type='text']", {
        state: "visible",
        timeout: FORM_WAIT_MS,
      });

      await fillCompanyForm(page, input, log);
      await ensureServiceStatus(page, log);

      log.info("branch.new", "등록 버튼 클릭");
      const registerBtn = page
        .locator(".v-btn")
        .filter({ has: page.locator(".v-btn__content", { hasText: "등록" }) })
        .first();
      await registerBtn.waitFor({ state: "visible", timeout: FORM_WAIT_MS });
      await registerBtn.scrollIntoViewIfNeeded().catch(() => null);
      await registerBtn.click({ timeout: 25000 });
      log.info("branch.new", "등록 버튼 클릭 완료");

      await page.waitForTimeout(SUBMIT_WAIT_AFTER_CLICK_MS);
      await page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {
        log.warn("branch.new", "networkidle 타임아웃 — 계속 진행");
      });
      await page.waitForURL(/\/company/, { timeout: REDIRECT_WAIT_MS }).catch(() => null);
      await page
        .locator(".v-btn", { hasText: "신규고객사 등록" })
        .waitFor({ state: "visible", timeout: 5000 })
        .catch(() => null);
      log.info("branch.new", "신규 플로우 후속 대기 완료", { url: page.url() });
    }

    try {
      log.info("context", "context.close()");
      await context.close();
    } catch (e) {
      log.warn("context", "context.close 경고", {
        err: e instanceof Error ? e.message : String(e),
      });
    }

    log.info("run.done", "CallCloud 자동화 성공", {
      branch: foundRow ? "edit" : "new",
    });
    return {
      success: true,
      message: foundRow
        ? "CallCloud 고객사 정보가 수정되었습니다."
        : "CallCloud 신규 고객사 등록이 완료되었습니다.",
    };
  } catch (caught: unknown) {
    const message = formatAutomationError(caught);
    log.error("run.fail", "자동화 예외 종료", {
      message,
      raw: caught instanceof Error ? caught.message : String(caught),
      stack: caught instanceof Error ? caught.stack : null,
    });
    return { success: false, error: message };
  } finally {
    if (browser) {
      const keepOpen =
        process.env.CALLCLOUD_KEEP_BROWSER_OPEN !== "false" && !getHeadless();
      if (!keepOpen) {
        try {
          log.info("browser", "browser.close() 호출");
          await browser.close();
          log.info("browser", "browser.close() 완료");
        } catch (e) {
          log.error("browser", "browser.close 실패", {
            err: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : null,
          });
        }
      } else {
        log.info(
          "browser",
          "브라우저 연결 유지 (CALLCLOUD_KEEP_BROWSER_OPEN && !headless)"
        );
      }
    }
  }
}
