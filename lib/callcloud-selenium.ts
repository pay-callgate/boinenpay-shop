/**
 * CallCloud 070 자동 등록 - Selenium Chrome 자동화
 * M7: 로그인 → 신규 고객사 등록 폼 입력 → 등록
 *
 * - 검증 시: CALLCLOUD_HEADLESS=false 로 Chrome 창 표시
 * - 운영 시: CALLCLOUD_HEADLESS=true 로 백그라운드 실행
 */

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

const CALLCLOUD_LOGIN_URL = "https://backoffice.callcloud.kr:27091/login";
const CALLCLOUD_COMPANY_NEW_URL = "https://backoffice.callcloud.kr:27091/company/new";
const DEFAULT_TIMEOUT_MS = 20000;

function getHeadless(): boolean {
  const v = process.env.CALLCLOUD_HEADLESS;
  return v === "true" || v === "1";
}

/**
 * CallCloud 백오피스 로그인 후 신규 고객사 등록 폼에 입력하고 등록 버튼 클릭
 */
export async function runCallCloudRegister(
  input: CallCloudRegisterInput
): Promise<CallCloudAutomationResult> {
  const { Builder, By, until } = await import("selenium-webdriver");
  const chrome = await import("selenium-webdriver/chrome");

  const headless = getHeadless();
  const loginId = process.env.CALLCLOUD_ID || "sh.lee";
  const loginPwd = process.env.CALLCLOUD_PWD || "callgate";

  let driver: Awaited<ReturnType<typeof Builder.prototype.build>> | null = null;

  try {
    const options = new chrome.Options();
    options.addArguments("--ignore-certificate-errors");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    if (headless) {
      options.addArguments("--headless=new");
      options.addArguments("--disable-gpu");
    }

    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    driver.manage().setTimeouts({ implicit: 10000, pageLoad: DEFAULT_TIMEOUT_MS });

    // 1) 로그인 페이지
    await driver.get(CALLCLOUD_LOGIN_URL);
    await driver.sleep(1500);

    // Login / Password 입력 (일반적인 name 또는 placeholder 기준)
    const loginInput = await driver.wait(
      until.elementLocated(By.css('input[type="text"], input[name="login"], input[placeholder*="Login" i], input[id*="login" i]')),
      DEFAULT_TIMEOUT_MS
    );
    await loginInput.clear();
    await loginInput.sendKeys(loginId);

    const pwdInput = await driver.findElement(
      By.css('input[type="password"], input[name="password"], input[placeholder*="Password" i]')
    );
    await pwdInput.clear();
    await pwdInput.sendKeys(loginPwd);

    const loginBtn = await driver
      .findElement(By.xpath("//button[contains(., 'LOGIN')]"))
      .catch(() => driver.findElement(By.css('input[type="submit"], button[type="submit"], .v-btn')));

    await loginBtn.click();
    await driver.sleep(3000);

    // 2) 신규 고객사 등록 페이지로 이동
    await driver.get(CALLCLOUD_COMPANY_NEW_URL);
    await driver.sleep(2000);

    // 3) 폼 입력 (Vue/Vuetify 계열 가정: input, textarea, select 등)
    const fillByLabel = async (labelText: string, value: string) => {
      const xpath = `//label[contains(., '${labelText}')]/following-sibling::*//input | //label[contains(., '${labelText}')]/following-sibling::*//textarea | //*[contains(text(), '${labelText}')]/following::input[1] | //*[contains(text(), '${labelText}')]/following::textarea[1]`;
      const el = await driver!.findElement(By.xpath(xpath)).catch(() => null);
      if (el) {
        await el.clear();
        await el.sendKeys(value);
      }
    };

    await fillByLabel("고객사명", input.clientName);
    await fillByLabel("인사말", input.greetingMessage);
    await fillByLabel("고객사 대표번호", input.call070Number.replace(/-/g, ""));
    await fillByLabel("관리자명", input.adminName);
    await fillByLabel("관리자 이메일", input.adminEmail);
    await fillByLabel("관리자 전화번호", input.adminPhone);
    await fillByLabel("서비스 URL", input.serviceUrl);
    await fillByLabel("SMS 텍스트", input.smsText);

    // 업종: 드롭다운 선택 (가능하면 industry 텍스트로 선택)
    try {
      const industrySelect = await driver.findElement(
        By.xpath("//label[contains(., '업종')]/following-sibling::*//select | //*[contains(., '업종')]/following::select[1]")
      );
      await industrySelect.click();
      await driver.sleep(300);
      const option = await driver.findElement(By.xpath(`//option[contains(., '${input.industry}')]`)).catch(() => null);
      if (option) await option.click();
    } catch {
      // 업종은 선택 사항으로 실패해도 진행
    }

    await driver.sleep(1000);

    // 4) 등록 버튼 클릭
    const registerBtn = await driver
      .findElement(By.xpath("//button[contains(., '등록')] | //*[contains(@class, 'btn')][contains(., '등록')]"))
      .catch(() => driver.findElement(By.css('button[type="submit"]')));
    await registerBtn.click();
    await driver.sleep(3000);

    return { success: true, message: "CallCloud 신규 고객사 등록 요청이 완료되었습니다." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("CallCloud Selenium error:", message);
    return { success: false, error: message };
  } finally {
    if (driver) {
      try {
        await driver.quit();
      } catch (e) {
        console.error("Driver quit error:", e);
      }
    }
  }
}
