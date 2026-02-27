# CallCloud 070 자동화 구현 (M7) — 스펙·에러·UI 수정

**병합 문서:** CALLCLOUD_070_AUTOMATION_SPEC + CALLCLOUD_070_ERROR_ANALYSIS + CALLCLOUD_070_UI_UPDATE_PLAN  
**최종 수정:** 2026-02-10

---

## Part 1. 스펙 (자동화 학습·플로우)

**목적:** CallLink [070번호 연동] 저장 데이터를 CallCloud 백오피스에 자동 등록/수정.  
**자동화 도구:** Playwright (Chromium). Vuetify 기반 → getByPlaceholder / getByRole / getByText / locator(hasText) 사용.  
**플로우:** 등록 여부 사전 검색 → 분기(기등록 시 수정, 미등록 시 신규 등록).  
**운영 모드:** 검증 시 `CALLCLOUD_HEADLESS=false`, 운영 시 `true`.

### 1.1 CallLink 측 (진입점)

| 항목 | 내용 |
|------|------|
| **페이지** | 링크 생성/배포 `/{subdomain}/admin/clients/links` |
| **버튼** | 「CallLink 연동하기」 → 070번호 연동 모달 (Call070Modal.tsx) |
| **070 연결** | 모달에서 [070번호 연결] 클릭 → `POST /api/clients/[id]/070/register` |

모달/DB 필드: 고객사명, 서비스 번호(070), 인사말, 고객사 대표번호, 업종, 관리자명/이메일/전화, 서비스 URL, SMS 텍스트.

### 1.2 CallCloud 백오피스

- 로그인: `https://backoffice.callcloud.kr:27091/login` (Login/Password, LOGIN 버튼)
- 고객사 관리: `/company`, 「신규고객사 등록」 → `/company/new`
- 폼: 고객사명, 인사말, 대표번호, 업종, 관리자 정보, 서비스 URL, SMS 텍스트, 서비스 상태 등

### 1.3 환경 변수

| 변수 | 설명 |
|------|------|
| CALLCLOUD_ID / CALLCLOUD_PWD | 로그인 계정 |
| CALLCLOUD_HEADLESS | true=백그라운드, false=창 표시 |
| NEXT_PUBLIC_APP_URL | 서비스 URL origin (선택) |

### 1.4 구현 파일

- `lib/callcloud-playwright.ts` — 로그인 → 070 검색 → 분기(수정/신규), state-based waiting
- `app/api/clients/[id]/070/register/route.ts` — DB 준비, serviceUrl 구성, Playwright 호출, DB 업데이트

---

## Part 2. 오류 분석 (Target page, context or browser has been closed)

**발생 로그:** `page.waitForTimeout: Target page, context or browser has been closed`, `POST .../070/register 500 in 31.2s`

**원인:** `waitForTimeout()` 호출 시점에 페이지/컨텍스트/브라우저가 이미 종료된 상태.

| 원인 | 설명 |
|------|------|
| A. 브라우저 창 종료 (headless: false) | 연동 중 사용자가 Chrome 창을 닫은 경우 |
| B. 요청/런타임 타임아웃 | API 30초 제한 등으로 연결 끊김 후 브라우저 정리 |
| C. 브라우저/탭 크래시 | Chromium 비정상 종료 |

**수정 반영:** safeWait 제거 후 state-based waiting 전환, API `maxDuration = 60`, "has been closed" 시 사용자 안내 메시지 반환.

---

## Part 3. UI/플로우 수정 (등록 버튼 제거, 070번호 연결만)

**요청:** [등록] → [070 연결] 단계 제거, **070번호 연결** 버튼만 노출. 연동 완료 후 DB 저장.

**적용 내용:**
- Call070Modal: [등록] 버튼 제거, [취소] [070번호 연결] 만 표시.
- 070번호 연결 클릭 시: 현재 폼으로 `POST /api/clients/[id]/070` (설정 저장) → 성공 시 `POST .../070/register` 호출.
- API는 연동 성공 시에만 `callcloud_registered`, `call_070_connected` 업데이트 (기존 동일).

---

## 변경 이력

| 날짜 (KST) | 내용 |
|------------|------|
| 2026-02-10 | 스펙·에러분석·UI수정계획 3개 문서 병합 → IMPLEMENTATION_070.md |
