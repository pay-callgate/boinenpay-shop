# CallLink 연결하기 — 로그인 입력 미실행 원인 분석 및 수정 계획

**작성일:** 2026-02-10  
**현상:** 070번호 연결 시 크롬 브라우저가 뜨는 것은 정상 확인. **로그인을 위한 입력 작업(ID/비밀번호 입력, LOGIN 클릭)이 실행되지 않음.**

---

## 1. 현재 구현 요약

| 구분 | 내용 |
|------|------|
| **진입** | 거래처 관리 → [070번호 연결하기] → 모달에서 [070번호 연결] 클릭 |
| **API** | `POST /api/clients/[id]/070/register` → `lib/callcloud-playwright.ts`의 `runCallCloudRegister()` 호출 |
| **플로우** | 1) Chromium 실행 → 2) `https://backoffice.callcloud.kr:27091/login` 이동 → **3) 로그인 입력** → 4) /company 이동 → 5) 070 검색·분기(수정/신규) |

로그인 단계 코드 (`lib/callcloud-playwright.ts` 131~136행):

```ts
await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.locator('input[name="login"]').fill(loginId);
await page.locator('input[name="password"]').fill(loginPwd);
await page.locator(".v-btn", { hasText: "LOGIN" }).click();
await page.waitForURL(/\/company/, { timeout: 15000 }).catch(() => null);
```

- **로그인 ID/비밀번호:** `process.env.CALLCLOUD_ID` / `process.env.CALLCLOUD_PWD` (미설정 시 코드 기본값 `sh.lee` / `callgate` 사용).

---

## 2. 원인 분석

### 2.1 가장 유력: 로그인 폼 셀렉터 불일치

- **가정:** 실제 CallCloud 로그인 페이지의 input/button이 현재 셀렉터와 다름.
- **현재 사용 셀렉터:**
  - ID 입력: `input[name="login"]`
  - 비밀번호: `input[name="password"]`
  - 버튼: `.v-btn` + 텍스트 `"LOGIN"`
- **가능한 실제 형태:**
  - `name`이 `userId`, `username`, `id` 등일 수 있음.
  - 비밀번호 필드가 `name="pwd"`, `name="pw"` 등일 수 있음.
  - 버튼 문구가 **"로그인"** 이거나, 클래스/구조가 달라 `.v-btn`이 없을 수 있음.
- **결과:** `page.locator('input[name="login"]').fill(loginId)` 단계에서 요소를 찾지 못해 **타임아웃 또는 예외 발생** → 로그인 입력이 수행되지 않고, API는 500 또는 에러 메시지 반환.

### 2.2 로그인 페이지 로딩 타이밍

- `waitUntil: "domcontentloaded"`만 사용하고 있어, **Vue/Vuetify가 로그인 폼을 그리기 전에** fill을 시도할 수 있음.
- SPA는 DOM이 준비된 뒤에도 input이 나중에 렌더될 수 있으므로, **로그인 폼(또는 최소 한 개 input)이 visible 될 때까지 대기**가 없음.

### 2.3 환경 변수 미설정

- `.env.local`에 `CALLCLOUD_ID`, `CALLCLOUD_PWD`가 없으면 코드 기본값(`sh.lee` / `callgate`)을 사용.
- 실제 계정이 다르면 로그인 자체는 실패할 수 있으나, **“입력이 실행되지 않는다”**는 현상의 주원인은 보통 셀렉터/타이밍 문제임.

### 2.4 정리

| 우선순위 | 원인 | 설명 |
|----------|------|------|
| **1** | 로그인 폼 셀렉터 불일치 | 실제 페이지의 input name / 버튼 텍스트·구조가 코드와 다름 → 첫 fill에서 실패 |
| **2** | 로그인 폼 표시 전에 fill 시도 | 폼이 보이기 전에 fill 호출 → 요소 없음/비가시로 실패 |
| **3** | 환경 변수 | 계정 오류는 “입력 후 로그인 실패” 단계 이슈로 보는 것이 타당 |

---

## 3. 수정 계획 (코드 반영 전 동의 필요)

다음과 같이 수정하는 것을 제안합니다. **이 계획에 동의하실 경우에만 코드를 수정하겠습니다.**

### 3.1 로그인 단계에 “폼 표시” 대기 추가

- **위치:** `lib/callcloud-playwright.ts` 로그인 블록(131행 근처).
- **내용:**
  - `page.goto(LOGIN_URL)` 후, **로그인 폼이 보일 때까지** 대기한 뒤 입력 시도.
  - 예: `input[name="login"]` 또는 `input[type="text"]` 또는 `input[type="password"]` 중 하나가 `visible` 될 때까지 `waitFor({ state: "visible", timeout: 15000 })` 추가.
- **목적:** SPA 렌더 지연으로 인한 “요소 없음” 오류 감소.

### 3.2 로그인 셀렉터 다중화(폴백)

- **위치:** 동일 파일, 로그인 입력 3줄.
- **내용:**
  - **ID 입력:**  
    - 1차: `input[name="login"]`  
    - 2차(폴백): `input[name="userId"]`, `input[name="username"]`, `input[placeholder*="아이디"]`, `input[type="text"]` (폼 내 첫 번째) 등 순서대로 시도.
  - **비밀번호:**  
    - 1차: `input[name="password"]`  
    - 2차: `input[name="pwd"]`, `input[name="pw"]`, `input[placeholder*="비밀"]`, `input[type="password"]` 등.
  - **버튼:**  
    - 1차: `.v-btn` + "LOGIN"  
    - 2차: "로그인" 텍스트 포함 버튼, 또는 `button[type="submit"]`.
- **구현 방식:**  
  - “가능한 셀렉터 목록”을 순회하며 `locator(...).first().isVisible()` 등으로 확인 후, 찾은 요소에만 `fill` / `click` 수행.  
  - 또는 `page.getByLabel(/아이디|ID|로그인/)` 등 Playwright 권장 API로 보완.
- **목적:** 실제 CallCloud 로그인 페이지 HTML이 예상과 다를 때에도 입력이 실행되도록 함.

### 3.3 (선택) 로그인 실패 시 에러 메시지 명확화

- **위치:** `lib/callcloud-playwright.ts` catch 블록 또는 로그인 직후 실패 분기.
- **내용:**
  - 로그인 단계에서 예외 발생 시, “로그인 입력 실패: 요소를 찾을 수 없습니다. CallCloud 로그인 페이지 구조가 변경되었을 수 있습니다.” 등 **사용자용 메시지**와, 개발자용으로 **실제 사용한 URL/단계**를 로그에 남기기.
- **목적:** 원인 파악 및 재발 방지.

### 3.4 (선택) 실제 페이지 구조 확인용 디버그

- **옵션:** 환경 변수 `CALLCLOUD_DEBUG=true` 일 때만, 로그인 페이지 로드 후 **일시 대기(예: 5초)** 또는 **스크린샷/HTML 일부 저장**하도록 하는 코드 추가.
- **목적:** 실제 DOM 구조를 확인해 셀렉터를 정확히 맞출 때 활용. 운영 환경에서는 사용하지 않음.

---

## 4. 적용 순서 제안

1. **3.1** 로그인 폼 visible 대기 추가  
2. **3.2** 로그인 셀렉터 폴백 추가 (한글 "로그인" 버튼, 다른 input name 등)  
3. **3.3** 로그인 실패 시 에러 메시지 보강  
4. (필요 시) **3.4** 디버그 옵션으로 실제 페이지 구조 확인 후 셀렉터 추가·정리  

---

## 5. 확인 요청

- **환경 변수:** `.env.local`에 `CALLCLOUD_ID`, `CALLCLOUD_PWD`를 실제 CallCloud 계정으로 설정해 두었는지 확인해 주세요.
- **동의:** 위 **수정 계획(3.1~3.3, 필요 시 3.4)에 동의하시면** 그에 맞춰 코드 수정을 진행하겠습니다. 일부만 적용을 원하시면 번호(예: 3.1만, 3.1+3.2만)를 알려 주세요.
