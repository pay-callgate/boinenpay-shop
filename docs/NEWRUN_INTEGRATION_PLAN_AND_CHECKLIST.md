# 뉴런시스템(Newrun) 발주연동 — 개발 계획 및 체크리스트

**문서 목적:** 
정상 결제(`payment_status = paid`) 건을 협회(가입 협회)로 발주 연동하기 위한 단계별 개발·테스트·검수 항목을 정리한다.  
**참고 규격:** `발주연동 서비스 - 개발참고문서 (V1.1)` (㈜뉴런시스템) — 발주(2.1), 수주화원 검색(2.2), 상품 검색(2.3), 옵션(2.4), 배송상태(2.6) 등.  
**코드·URL 네이밍:** `neuron`이 아닌 **`newrun`** 사용.

---

## 0. 전제·범위

### 0.0 체크박스 표기

- 각 Phase의 **Tasks**에서 **`[x]`** 는 **구현 완료**(해당 코드·동작이 저장소에 반영됨)를 뜻한다.
- **검증 완료**(실측·스테이징·회귀 테스트 등)는 같은 Phase의 **「테스트·체크리스트」** `[x]`와 **부록 B** 진행 표의 테스트 열을 따른다. Task만 `[x]`인 것은 **검증까지 끝난 것으로 보지 않는다.**

### 0.1 전제 (사전조건)

다음은 **뉴런·협회 측 세팅이 완료된다**는 전제하에 개발을 진행한다. 세팅 지연 시 **목(Mock) 모드**로 선행 개발한다.

- [ ] 뉴런 발주연동 서비스 신청·과금(CMS 등) 절차 이해 및 담당자 연락처 확보
- [ ] `rw_rosewebid`, `rw_rosewebpw`(또는 통보된 인증키), `rw_assoc`(협회코드) 등 **뉴런 통보 인증값** 확정
- [ ] 협회 인트라넷 **발주화원 ID** — `rose_session` 생성에 사용 (문서 2.2)
- [ ] **발주 리턴 URL**(`rw_returnurl`), **배송결과 수신 URL** — 뉴런·우리부고(또는 직접) 등록 완료
- [ ] 협회 도메인에서 `member_ext/member_search.htm`, `member_ext/check_good_ext.htm` 등 **실제 경로·파라미터** 실측 (문서와 동일 여부)

### 0.2 범위

| 포함 | 제외(후순위) |
|------|----------------|
| 결제 완료 후 발주 전송(2.1), 결과 저장 | 뉴런 문서에 없는 **취소·환불 연동 API** (별도 협의) |
| 수주화원·상품 선택: **협회 `member_ext` + `var_ret`** 우선 | 인트라넷과 동일한 **지도·가맹점 UI 자체 구현** |
| 배송상태 콜백(2.6) 수신·주문 상태 반영 | 다협회 일반화(1차는 단일 협회 기준 가능) |
| **파트너 Admin — 주문 관리** (`/admin/orders`, 상세, 배송 관리) 화면·API 확장 | 취소/반품 **자동 연동**(문서 없음 — `returns`는 정책·수동 위주) |

### 0.3 목(Mock)·실연동 플래그 (권장 환경변수)

실제 값은 `.env.local` / 배포 환경에만 두고 **Git에 커밋하지 않는다.**

| 변수 (예시) | 용도 |
|-------------|------|
| `NEWRUN_ENABLED` | `true`일 때만 실제 외부 호출 (기본 `false` 권장) |
| `NEWRUN_MOCK` | `true`면 `intranet_post` 등을 호출하지 않고 고정 성공/실패 시나리오로 동작 |
| `NEWRUN_MOCK_RWR_RESULT` | (선택) Mock 시 `rwr_result`, 기본 `0`. `20`이면 중복 시뮬레이션 |
| `NEWRUN_ASSOC_BASE_URL` | 협회 인트라넷 베이스 URL (예: `https://www.kot45.com`) |
| `NEWRUN_ASSOC_INTRANET_ID` | `rose_session`용 base64에 넣는 발주화원 인트라넷 아이디 |
| `NEWRUN_ROSEWEB_ID` / `NEWRUN_ROSEWEB_PW` | 발주(2.1) `rw_rosewebid`, `rw_rosewebpw` (뉴런 통보명과 일치시킬 것) |
| `NEWRUN_ASSOC_CODE` | `rw_assoc` |
| `NEWRUN_INTRANET_POST_URL` | 기본값 `http://ext2intra.roseweb.co.kr/intranet_post.html` — **최신 URL 뉴런 확인** |
| `NEWRUN_RW_RETURNURL` | `rw_returnurl` 절대 URL — **권장:** `https://<앱도메인>/admin/newrun/po-return` (파트너·운영자용, 쇼핑몰 고객 화면 아님). 구형 `/{subdomain}/{clientSlug}/newrun/po-return` 은 동일 쿼리로 `/admin/...` 으로 리다이렉트만 함 |
| `NEWRUN_PO_RETURN_SECRET` | (권장) 설정 시 발주 POST의 `rw_returnurl`에 `nrpt`(주문번호 HMAC)를 붙이고, po-return에서 위변조·오매칭 완화. 미설정 시 `rwr_sno`만으로 매칭 |
| `NEXT_PUBLIC_WOORIBUGO_CS_TEL` | (권장) po-return **실패·오류** 시 안내에 노출할 우리부고 고객센터 전화(예: `02-1234-5678`). 미설정 시 문구만 표시 |
| `NEWRUN_DEFAULT_RW_METHOD` | (선택) `rw_method` 기본값, 미설정 시 매핑에서 `1` |

### 0.4 용어: 코드의 `florist`와 우리부고 상품 범위(화환 전용)

**요지:** DB·API에서 쓰는 `florist`는 **“꽃다발·꽃바구니를 파는지 여부”와 무관**하다. 뉴런·협회 문서 **2.2 수주화원 검색**에 대응하는 콜백 종류(`kind`)를 코드에서 영문 관례로 붙인 이름이다.

| 구분 | 의미 |
|------|------|
| **협회·뉴런 문맥** | **수주화원** — 발주를 **받는** 쪽 가맹·화원(배정·인수 주체). `member_search` 등으로 선택한다. |
| **코드 `kind` 값 `florist`** | 위 **수주화원 검색** `var_ret` 한 줄기. 콜백 경로: `/api/integrations/newrun/callback/florist`. |
| **DB 컬럼 `orders.newrun_florist_draft`** | 그 콜백에서 돌아온 선택값(JSON). `kind`·라우트명과 맞추기 위해 `florist`를 유지한다. |
| **우리부고 사업 범위** | **꽃다발·꽃바구니는 상품에서 제외**, **근조·축하 화환** 중심 판매. 이는 **쇼핑몰 카탈로그·주문 품목** 이야기이며, **수주화원(배송 받을 가맹)을 고르는 단계**와는 별개다. 화환만 팔더라도 협회 발주 흐름상 수주화원 검색·저장은 동일하게 필요하다. |

**UI·문서 표기:** 화면·기획서에는 협회와 동일하게 **「수주화원」** 등 한글 용어를 쓰고, 개발자는 `florist` = 수주화원 검색 한 종류로 이해하면 된다. 컬럼명을 `suju` 등으로 바꾸려면 `kind`, 콜백 URL, `NEWRUN_ORDER_DRAFT_COLUMNS`, 어드민 저장 API까지 **일괄 리네이밍**이 필요하므로 현재는 `florist` 고정을 권장한다.

---

## Phase 0 — 기반·스텁 (완료 여부 점검)

**목표:** 심사/접속 테스트 시 404 방지, 이후 로직 확장의 착지 확보.

### Tasks

- [x] **T0.1** `app/api/integrations/newrun/delivery-status/route.ts` — `GET` / `POST` / `HEAD` 수신, `console.log`, 응답 `{ "success": true }`, HTTP 200, `dynamic = "force-dynamic"`
- [x] **T0.2** `app/[subdomain]/[clientSlug]/newrun/po-return/page.tsx` — 쿼리 파라미터 표시, 안내 문구(발주 처리 결과 확인 중)
- [ ] **T0.3** 운영 도메인에서 위 두 URL **HTTPS 200** 확인 (신청서 기재 URL과 일치) — **배포 후 담당자 점검**

### 테스트·체크리스트

- [ ] 브라우저/CLI로 `delivery-status` GET 호출 → 200, JSON `success`
- [ ] POST(form/json) 호출 → 서버 로그에 body/query 기록, 200
- [ ] (선택) `HEAD /api/integrations/newrun/delivery-status` → 200
- [ ] `po-return`에 임의 쿼리(`?rwr_result=0&rwr_sno=TEST`) 붙여 표시 확인

**로컬 점검 예시 (개발 서버 실행 중)**

```bash
curl -sS "http://localhost:3000/api/integrations/newrun/delivery-status?oid=test&state=3"
curl -sS -X POST "http://localhost:3000/api/integrations/newrun/delivery-status" -H "Content-Type: application/json" -d "{\"oid\":\"x\",\"state\":4}"
```

---

## Phase 1 — `rose_session`·협회 검색 URL 빌더

**목표:** 문서 2.2와 동일한 세션 문자열 생성 및 `member_search` / `check_good_ext` / (필요 시) `option_item_ext` URL 생성을 **서버에서만** 수행.

### Tasks

- [x] **T1.1** `lib/newrun/rose-session.ts` — `buildRoseSession(intranetId, { nowSec? })` (PHP 예제와 동일 알고리즘)
- [x] **T1.2** `lib/newrun/association-search-urls.ts` — `buildMemberSearchUrl`, `buildProductSearchUrl`, `buildOptionSearchUrl`
- [x] **T1.3** `lib/newrun/server-search-urls.ts` — `var_ret` = `getBaseUrl()` + `NEWRUN_CALLBACK_PATHS` (`lib/app-url.ts`의 서버 분기와 정합). env: `NEWRUN_ASSOC_BASE_URL`, `NEWRUN_ASSOC_INTRANET_ID`
- [x] **T1.4** 결정적 검증: `nowSec = 1700000000`, `intranetId = "test"` → `buildRoseSession` 결과는 아래 **고정 문자열**과 일치해야 함 (PHP 동일 입력 대조용)

### 구현 파일 (요약)

| 파일 | 역할 |
|------|------|
| `lib/newrun/rose-session.ts` | `rose_session` 생성 |
| `lib/newrun/association-search-urls.ts` | 협회 `member_ext` URL 조립 |
| `lib/newrun/constants.ts` | `var_ret` 경로 상수 ↔ `callback/[kind]` 라우트 |
| `lib/newrun/server-search-urls.ts` | env + `getBaseUrl()`로 절대 URL까지 합성 |
| `lib/newrun/index.ts` | 재export |

### 테스트·체크리스트

- [ ] **T1.4 문자열:** `nowSec=1700000000`, id=`test` →  
  `MTcwMDAwMDAwMA==DiV24920decf83f6960b80f737a28eeafc1DiVdGVzdA==`
- [ ] 서버에서 `buildFloristSearchUrlUsingAppConfig({ nowSec: 1700000000 })` 호출 시 URL에 `member_search.htm`, `var_ret`에 본인 도메인 포함되는지 (`.env`에 `NEWRUN_*`, `NEXT_PUBLIC_APP_URL` 설정)
- [ ] 로컬에서 생성된 URL을 브라우저에 붙여 **협회 페이지가 열리는지** (뉴런·협회 세팅 완료 후)
- [ ] `var_ret`가 프로덕션/스테이징 의도한 도메인인지 확인

---

## Phase 2 — `var_ret` 콜백 수신 (수주화원·상품·옵션)

**목표:** 협회 팝업에서 선택 후 돌아오는 파라미터를 수신하고, 발주 폼/어드민과 연계 가능한 형태로 저장.

### Tasks

- [x] **T2.1** 통합 라우트: `GET` / `POST` / `HEAD` — `app/api/integrations/newrun/callback/[kind]/route.ts`  
  - `kind` = `florist` | `product` | `option` (`NEWRUN_CALLBACK_PATHS`와 동일)
- [x] **T2.2** 수신 파싱·저장: `lib/newrun/callback-request.ts` — 쿼리 + JSON·폼 본문 → Supabase `newrun_callback_results` (마이그레이션 `20260331100001_newrun_callback_results.sql.txt`)
- [x] **T2.3** 팝업 → 부모 창: HTML 응답 내 `postMessage({ type: "NEWRUN_VAR_RET", kind, payload }, location.origin)`  
  - 테스트용: `Accept: application/json` 또는 `?format=json` → JSON `{ success, id, kind, query, body }`
- [ ] **T2.4** CSRF·스푸핑 완화: `var_ret`에 **서명된 state**·공유 시크릿(뉴런 협의) — **후속**

**문서 2.2.3 참고 (수주화원):** `var_sid`, `var_corp`, `var_name`, `var_jiyok`, `var_tel`, `var_fax` 등 — 협회 구현에 따라 키가 다를 수 있어 **원문 JSON 그대로 보관**.

### 테스트·체크리스트

- [ ] Supabase에 마이그레이션 적용 후 INSERT 성공 확인
- [ ] `curl.exe "http://localhost:3000/api/integrations/newrun/callback/florist?format=json&var_sid=test&var_corp=가맹"` → `success: true`, DB에 행 생성
- [ ] 브라우저에서 동일 URL(쿼리만) → HTML + 부모 창 `message` 이벤트(로컬에서 `window.open`으로 검증)
- [ ] 협회 팝업 실연동 시 실제 파라미터 키 확인
- [ ] (후속) T2.4 토큰 검증

---

## Phase 3 — 선택 UX (수주화원·상품)

**목표:** 문서 2.2·2.3(·2.4) 패턴 — **협회 호스트 UI**를 열고 결과를 주문 발주 데이터에 반영.  
**용어:** API·DB의 `florist` = 수주화원 검색(화환 전용 판매 정책과 무관) — 상세는 **0.4절** 참고.

### 구현 요약 (코드)

| 구분 | 내용 |
|------|------|
| 검색 URL API | `GET /api/partner/integrations/newrun/search-url?kind=florist` (또는 `product` / `option`) `&orderId=` — 파트너 어드민·주문 소속 검증 후 서버에서 `build*SearchUrlForServer(origin)` |
| origin | `lib/newrun/request-app-origin.ts` — `NEXT_PUBLIC_APP_URL` 우선, 없으면 요청 Host |
| 어드민 UI | `app/admin/(dashboard)/orders/[id]/page.tsx` — 검색 세 버튼, 병합 표시, `intranet_post` 미리보기, 팝업·모바일·카카오 인앱 안내 |

### Tasks

- [x] **T3.1** 주문 상세 **「수주화원 검색」** → API로 URL 수신 후 `window.open`
- [x] **T3.2** **「상품 검색」**, **「옵션 상품 검색」** 동일 패턴
- [x] **T3.3** 콜백 payload를 **`orders` 확장 컬럼·발주 draft DB 저장** — `newrun_*_draft` JSONB, `PATCH /api/partner/orders/[id]/newrun-draft`
- [x] **T3.4** 폴백: 거래처·상품별 **기본 수주화원·기본 상품코드**(DB/설정)  
  - DB: `clients.newrun_default_florist_draft`, `products.newrun_default_product_draft` / `newrun_default_option_draft` (`20260331130000_newrun_default_drafts.sql.txt`)  
  - 저장: `PUT /api/clients/[id]` 본문 `newrunDefaultFloristDraft`, `PUT /api/products/[id]` 본문 `newrunDefaultProductDraft` / `newrunDefaultOptionDraft` (`null` 또는 `{}`로 비움)  
  - 병합: `lib/newrun/merge-order-drafts.ts` — 주문 상세에 **발주 시 적용(병합)** 표시; 상품·옵션은 **첫 번째 주문 품목** 기준  
  - UI: 파트너 **상품 수정** 화면에 뉴런 JSON 블록(거래처 기본은 API·콘솔 등으로 설정 가능)
- [x] **T3.5** 1차는 **어드민 주문 상세**만 (고객 체크아웃 미노출)

### 테스트·체크리스트

- [x] 데스크톱 브라우저: 팝업 차단 시 안내 — 주문 상세 `openNewrunSearch`에서 `window.open` 실패 시 알림
- [x] 모바일: 팝업/인앱 — 좁은 화면에서 진행 확인, 카카오 인앱 시 외부 브라우저 안내(`isKakaoTalkInAppBrowser`)
- [ ] 기본값만으로 발주 POST가 가능한지(스모크) — **Phase 5** 실제 `intranet_post`와 연계 후 최종 확인. 현재는 `GET .../newrun-preview`로 필드·`blockingIssues` 점검 가능

---

## Phase 4 — 주문 데이터 → `rw_*` 매핑 (2.1.3)

**목표:** `orders`, `order_items`, 배송·리본·시간 등을 뉴런 필드 길이·필수·형식에 맞게 변환.

### Tasks

- [x] **T4.1** `lib/newrun/map-order-to-newrun-payload.ts` — 입력 `order` + `items` + 병합 draft + 인증 → `fields` / `warnings` / (`strict: false` 시) `blockingIssues`. `newrunFieldsToSearchParams` — Phase 5 폼 POST용
- [x] **T4.2** 기본 필드: `rw_sender=100`, `rw_style=0`, `rw_method`(env 또는 `1`), `rw_sno`, `rw_returnurl`, `rw_rosewebid`, `rw_rosewebpw`, `rw_assoc`, `rw_sendsms`/`rw_sendfax`, `rw_price`, `rw_aname`, `rw_atel`, `rw_arrive_place1`, `rw_bdate` — 협회 실측 시 길이·별칭 조정
- [x] **T4.3** `rw_price` int(원) 반올림, 전화·문자열 `NEWRUN_RW_STRING_LIMITS` 초과 시 잘림 + `warnings`
- [x] **T4.4** `rw_sno` 기본: **`order_no`** (`MapOrderToNewrunPayloadOptions.rwSnoSource`로 `order_id` 선택 가능). 동일 `rw_sno` 재전송 시 뉴런 결과코드 20 등은 **Phase 5**에서 처리
- [x] **T4.5** `splitShippingDetailForRw` — `shipping_detail` → `rw_memo` 우선, 초과·옵션 시 `rw_shopreq`

### 구현·연계

| 구분 | 내용 |
|------|------|
| 미리보기 API | `GET /api/partner/orders/[id]/newrun-preview` — 파트너 어드민, `rw_rosewebpw` 마스킹, `envHints`로 필수 env 설정 여부 |
| 어드민 UI | 주문 상세 — 「intranet_post 필드 미리보기」 및 JSON 표시 |

### 테스트·체크리스트

- [ ] 협회 실주문 샘플으로 필드 스냅샷 대조
- [x] 필수 누락 시 `strict: true`(기본)에서 `NewrunPayloadValidationError` — 미리보기는 `blockingIssues` 배열

---

## Phase 5 — 발주 전송 `intranet_post` (2.1)

**목표:** 정상 결제 건에 대해 뉴런 게이트웨이로 발주 요청 전송 및 결과 처리.

### 정책 (확정) — 발주 시점 A + B

| 구분 | 내용 |
|------|------|
| **기본** | **ViewPay 결제 완료 직후 자동 발주** — `app/api/payment/viewpay/complete` 처리 흐름에서 `intranet_post` 호출(또는 동일 트랜잭션 직후 비동기 단계). `NEWRUN_ENABLED` / `NEWRUN_MOCK` 분기 유지. |
| **실패 시** | 자동 발주가 **오류·검증 실패·타임아웃** 등으로 끝나면 **사용자에게 `alert`(또는 동등한 명시적 알림)** 으로 안내하고, **파트너 어드민 주문 상세**에서 **「발주 실행」 수동 재시도** 가능하도록 구현한다. |
| **요약** | 옵션 A(자동)를 기본으로 하되, 옵션 B(수동)를 **보조·복구 경로**로 반드시 둔다. |

구현 시 자동 경로에서 실패한 주문은 DB에 **실패 코드·메시지·재시도 필요 플래그** 등을 남겨 어드민에서 식별 가능해야 한다(T5.4와 연계).

### 추후 확정 (뉴런시스템 피드백 대기)

아래는 **뉴런 측 실측·회신 후** 코드·문서를 맞출 항목이다. 피드백 전까지는 Mock·스테이징 가정으로 개발한다.

- `intranet_post` **최종 URL**, 요청 **`Content-Type`**, 본문 **문자 인코딩(EUC-KR vs UTF-8)**  
- 응답 형태(순수 폼 파라미터 vs HTML 본문 vs 리다이렉트) 및 **`rwr_result` / `rwr_orderkey`** 파싱 규칙  
- (필요 시) 필드별 필수·길이·코드표 보정 — Phase 4 `NEWRUN_RW_STRING_LIMITS`·별칭 배열과 정합  

### Tasks

- [x] **T5.1** `lib/newrun/submit-order.ts` — `NEWRUN_MOCK`·`NEWRUN_ENABLED` 분기, Mock 시 `NEWRUN_MOCK_RWR_RESULT`
- [ ] **T5.2** 실연동 인코딩 — 요청은 **UTF-8** `application/x-www-form-urlencoded; charset=UTF-8` 고정 (`newrunFieldsToSearchParams`). **EUC-KR 등은 뉴런 피드백 후** 별도 인코딩 단계 추가. UTF-8 경로는 `npm run test`(Vitest)로 회귀 검증.
- [x] **T5.3** `lib/newrun/parse-intranet-post-response.ts` — 본문·`Location`·HTML hidden input·JSON 조각에서 `rwr_result` / `rwr_orderkey` 추출 (**실측 패턴 보강 + 단위 테스트**)
- [x] **T5.4** DB: `20260415120000_orders_newrun_submit.sql.txt` — `newrun_submit_status`, `newrun_rwr_result`, `newrun_rwr_orderkey`, `newrun_last_submit_error`, `newrun_last_submit_at`
- [x] **T5.5** **트리거:** ViewPay `complete` 직후 `submitNewrunOrder` · `POST /api/partner/orders/[id]/newrun-submit` · 주문 완료 페이지 `newrun` 실패 시 **toast + alert**
- [x] **T5.6** `rwr_result=20` → `duplicate` 상태·성공 계열 메시지(멱등). 어드민 **강제 재시도**(`forceRetry`)로 재전송 가능

### 테스트·체크리스트

- [x] **`NEWRUN_MOCK` 발주 경로 자동 검증:** `npm run test` — Mock 성공(0)·중복(20)·실 HTTP 응답 HTML 파싱·미결제 거절 (`lib/newrun/submit-order.test.ts`, `parse-intranet-post-response.test.ts`). ViewPay `complete` → DB까지의 **브라우저 E2E**는 PG·시드 주문이 필요하면 수동/스테이징에서 추가.
- [ ] 스테이징 + `NEWRUN_ENABLED=true`: 실제 **결과코드 0** 확인
- [ ] 실패 코드 2,3,11… 등 **어드민 표시·재시도** 확인

---

## Phase 6 — 발주 리턴 페이지 고도화 (`po-return`)

**목표:** 브라우저 리턴 시 `rwr_*`를 DB에 반영하고 사용자에게 명확한 메시지 표시.

### Tasks

- [x] **T6.1** 서버에서 쿼리 수신 후 주문 매칭·`orders` 갱신 — `rwr_sno`/`rw_sno` 등 → `orders.order_no`. (선택) `NEWRUN_PO_RETURN_SECRET` + 발주 시 URL에 붙인 `nrpt`로 검증 (`lib/newrun/po-return-signing.ts`, `apply-po-return.ts`). **착지:** `app/admin/newrun/po-return/page.tsx` + 미들웨어에서 해당 경로만 비로그인 허용(쿼리 보존). `submit-order`에서 `rw_returnurl`에 `nrpt` 병합. 레거시 매장 경로는 `/admin/...` 로 리다이렉트
- [x] **T6.2** 성공/실패 UI — 운영자용 문구(마이페이지 미사용), 실패·시스템 오류 시 **우리부고 고객센터** 안내 (`NEXT_PUBLIC_WOORIBUGO_CS_TEL`), `components/admin/NewrunPoReturnView.tsx`
- [x] **T6.3** `order_status_history`에 메모 기록(발주 리턴 요약). 주문 컬럼은 `newrun_submit_status` / `newrun_rwr_*` 와 `submit-order`와 동일 규칙

### 테스트·체크리스트

- [ ] 시뮬레이션 쿼리로 성공·실패 화면 확인 (예: `http://localhost:3000/admin/newrun/po-return?rwr_result=0&rwr_sno=<order_no>` — `NEWRUN_PO_RETURN_SECRET` 사용 시 `nrpt` 포함 URL로 발주한 뒤 동일 주문번호로 검증)
- [ ] DB 반영 후 어드민 주문 상세와 일치
- [x] `nrpt` HMAC 단위 테스트: `npm run test` (`lib/newrun/po-return-signing.test.ts`)

### 운영 참고

- 뉴런 리다이렉트가 **`rw_returnurl`에 붙인 쿼리(`nrpt` 등)를 유지하지 않으면** `NEWRUN_PO_RETURN_SECRET` 검증이 실패할 수 있다. 실패 시 시크릿을 끄거나 뉴런·협회에 쿼리 보존 여부를 확인한다.
- **`/admin/newrun/po-return`은 로그인 없이 열 수 있도록** 미들웨어에서 예외 처리한다. 민감 정보는 URL에 넣지 말 것. DB 반영은 Service Role 서버 코드만 수행한다.

---

## Phase 7 — 배송상태 콜백 (2.6)

**목표:** `oid`, `state`(2/3/4), `ordercode` 등 수신 → 내부 주문 상태·이력 반영.

### Tasks

- [x] **T7.1** `app/api/integrations/newrun/delivery-status/route.ts` — GET·POST, 쿼리 + JSON·`x-www-form-urlencoded`·`multipart`(문자 필드)·기타 본문 파싱. `lib/newrun/delivery-status-callback.ts`의 `mergeNewrunDeliveryParams`
- [x] **T7.2** `oid`(및 별칭 `order_id`) → `orders.order_no` 매칭
- [x] **T7.3** `state` → `orders.status`: `2`→`confirmed`(주문확정·제작진행), `3`→`shipping`, `4`→`delivered`. 알 수 없는 `state`는 상태 컬럼 미변경·`newrun_delivery_info`만 갱신 가능
- [x] **T7.4** `orders.newrun_delivery_info` JSONB — `ordercode`, `dica`, `insuname`, `insurel`, `insudate1`, `insudate2`, `state`, `lastCallbackAt` 등 (마이그레이션 `20260420120000_orders_newrun_delivery_info.sql.txt`)
- [ ] **T7.5** 출처 검증(IP 허용목록 등) 뉴런 협의 시 적용

### 테스트·체크리스트

- [ ] Postman 등으로 샘플 payload 전송 → 상태·이력 갱신
- [x] 존재하지 않는 `oid` 등 실패 시에도 **HTTP 200** + `{ success: true }` (재시도 완화) — 로그·DB 미반영

### 구현 참고

- 상태 변경 시에만 `order_status_history`에 `뉴런 배송상태 업데이트 (상태코드: X)` 메모 삽입

---

## Phase 8 — 파트너 Admin 주문 관리 화면 수정·고객 노출

**목표:** 중앙 집중형 **파트너 어드민** (`/admin/orders/*`)에서 뉴런 발주·배송 상태를 조회·조작하고, 쇼핑몰 고객 화면과 라벨을 맞춘다.

**관련 경로 (현 코드 기준)**

| 화면 | 파일 | 비고 |
|------|------|------|
| 주문 목록 | `app/admin/(dashboard)/orders/page.tsx` | 필터·테이블 컬럼·배지 |
| 주문 상세 | `app/admin/(dashboard)/orders/[id]/page.tsx` | 발주·상태·송장·이력 |
| 배송 관리 | `app/admin/(dashboard)/orders/shipping/page.tsx` | 택배 중심 UI — 화훼와 병행 시 분기 |
| 취소/반품 | `app/admin/(dashboard)/orders/returns/page.tsx` | 뉴런 자동 취소 없음 — 정책 안내만 |

**백엔드 (연동 시 확장 예정)**

- `GET/PATCH /api/partner/orders`, `GET /api/partner/orders/[id]` 등 — 주문 응답에 `newrun_*` / 발주 시각 / 협회 주문키 필드 포함
- (선택) `POST /api/partner/orders/[id]/newrun/submit` — 수동 재발주

---

### 8.1 주문 목록 (`/admin/orders`)

**목표:** 한눈에 **결제·발주·뉴런 처리 상태**를 구분한다.

#### Tasks

- [ ] **T8.1.1** 테이블 컬럼(또는 서브 배지): **발주 연동 상태** 예) `미전송` / `전송완료` / `실패(코드)` / `확인필요` — DB·API 필드와 매핑
- [ ] **T8.1.2** (선택) **협회 주문번호**(`rwr_orderkey`) 축약 표시 + 상세 링크
- [ ] **T8.1.3** 필터: `payment_status=paid` + 발주 상태, 거래처·기간 필터와 **AND** 동작 확인
- [ ] **T8.1.4** `STATUS_LABELS` / DB `received` 등 **기존 상태 표기**와 뉴런 연동 후 상태 enum **정합성** (`docs/ORDER_UPDATE_FAILURE_ANALYSIS.md` 참고)

#### 테스트·체크리스트

- [ ] 발주 실패 건만 필터·정렬(있다면)으로 조회 가능
- [ ] 목록 API 응답 크기·N+1 없음

---

### 8.2 주문 상세 (`/admin/orders/[id]`)

**목표:** 발주 전 준비(수주화원·상품)·**발주 실행/재발주**·결과 확인의 **단일 허브**.

#### Tasks

- [ ] **T8.2.1** 섹션 **「뉴런(Newrun) 발주」**: 마지막 발주 시각, `rwr_result`, `rwr_orderkey`, 원문 에러(있을 때), **재발주** 버튼
- [ ] **T8.2.2** Phase 3과 연계: **수주화원 검색 / 상품 검색 / (옵션)** 버튼 및 선택값 표시(`rw_sujuid`, `rw_menucode` 등)
- [ ] **T8.2.3** **「발주 실행」**: `payment_status === paid` 및 필수 `rw_*` 검증 후 API 호출 — Mock/실연동 분기
- [ ] **T8.2.4** 기존 **택배사·송장** 블록: 화훼 주문은 **뉴런 배송 콜백(2.6) 위주**일 수 있음 → `NEWRUN` 주문일 때 **읽기 전용 안내** 또는 필드 숨김(정책에 따라)
- [ ] **T8.2.5** 상태 변경 드롭다운: 수동 변경과 **콜백 반영** 충돌 시 우선순위 문서화(권장: 콜백 우선 또는 어드민만 덮어쓰기 허용 범위)
- [ ] **T8.2.6** 상태 이력: 발주 시도·뉴런 응답·배송 콜백이 `order_status_history`에 남는지

#### 테스트·체크리스트

- [ ] 비결제 건에서 발주 버튼 비활성·토스트
- [ ] 재발주 시 멱등(결과코드 20) UX
- [ ] 권한: 타 파트너 `id` 접근 403

---

### 8.3 배송 관리 (`/admin/orders/shipping`)

**목표:** 택배 송장 중심 화면과 **화훼(뉴런 콜백) 배송**을 혼용하지 않도록 한다.

#### Tasks

- [ ] **T8.3.1** 뉴런 연동 주문 식별(플래그 또는 `neuron_order_key` 존재 등) 시 **리스트 배지** — “협회 배송 추적”
- [ ] **T8.3.2** 송장/택배사 편집: 화훼 건은 **비활성 또는 선택** — 수동 입력이 필요한지 운영 정책 확정
- [ ] **T8.3.3** 배송 상태는 가능하면 **2.6 콜백 반영 값**과 동기화; 수동 `PATCH`와의 관계는 8.2.5와 동일 원칙

#### 테스트·체크리스트

- [ ] 일반 택배 주문: 기존 플로우 회귀 테스트
- [ ] 뉴런 주문: 송장 없이도 목록·상태 표시 정상

---

### 8.4 취소/반품 (`/admin/orders/returns`)

**목표:** 뉴런 문서에 **취소 API가 없음** — 화면/가이드만 정리.

#### Tasks

- [ ] **T8.4.1** (문서/툴팁) 발주 완료 후 취소는 **협회·뉴런 수동 처리** 필요할 수 있음을 안내
- [ ] **T8.4.2** 기존 반품 UI와 충돌 없음 확인

#### 테스트·체크리스트

- [ ] 회귀: 기존 returns 페이지 로드·권한

---

### 8.5 쇼핑몰 고객 화면 (회원·비회원)

#### Tasks

- [ ] **T8.5.1** 마이페이지·비회원 조회: 내부 상태 기준 **한글 라벨** (뉴런 원코드 비노출 또는 툴팁만)
- [ ] **T8.5.2** 알림(선택): 발주 실패 시 운영 알림(슬랙/메일/카카오 등) — 고객 노출은 정책에 따름

#### 테스트·체크리스트

- [ ] 역할별 권한: 타 거래처 주문 노출 없음
- [ ] 고객 화면 문구 UX 리뷰

---

## Phase 9 — 운영·문서화·종료

### Tasks

- [ ] **T9.1** 내부 연동 명세: `rw_*` ↔ DB 컬럼 매핑표 (버전 관리)
- [ ] **T9.2** `.env.example`에 `NEWRUN_*` **플레이스홀더만** 추가 (비밀 미기재)
- [ ] **T9.3** 장애 대응: 뉴런 장애 시 발주 보류·수동 처리 절차
- [ ] **T9.4** 프로덕션 `NEWRUN_ENABLED` 켜기 전 최종 체크

### 테스트·체크리스트

- [ ] 스테이징 전 구간 E2E 1건 이상
- [ ] 프로덕션 소액 테스트(협의된 테스트 계정) 후 일반 오픈

---

## 부록 A — 결과코드 2.1.5 (발주) 빠른 참고

개발·어드민 메시지 매핑 시 문서 원문을 따른다. (예: `0` 발주성공, `20` 중복, `99` 서버접속 불가 등)

---

## 부록 B — 진행 상태 요약 (팀용)

| Phase | 이름 | 개발 완료 | 테스트 완료 | 비고 |
|-------|------|-----------|-------------|------|
| 0 | 스텁 | [x] | [ ] | T0.3·테스트는 배포/로컬 확인 |
| 1 | rose_session / URL | [x] | [ ] | T1.4·협회 실측은 세팅 후 |
| 2 | var_ret 콜백 | [x] | [ ] | T2.4·실연동 테스트 남음 |
| 3 | 선택 UX | [x] | [ ] | 실협회 테스트·Phase 5 POST 스모크 남음 |
| 4 | 매핑 | [x] | [ ] | 실주문 스냅샷 대조·협회 필드 실측 |
| 5 | 발주 전송 | [x] | [~] | Mock·파싱 단위 테스트 완료; 스테이징 실연동·인코딩(T5.2) 잔여 |
| 6 | po-return 고도화 | [x] | [~] | 스테이징·nrpt 보존·실쿼리 검증 남음 |
| 7 | 배송 콜백 | [x] | [ ] | T7.5·실통보 테스트 남음 |
| 8 | 어드민·고객 | [ ] | [ ] | 목록·상세·배송·returns·고객 |
| 9 | 운영 | [ ] | [ ] | |

### 부록 C — Admin 주문 관리 세부 체크 (Phase 8 한 장 요약)

- [ ] **목록** `orders/page.tsx`: 발주 상태 컬럼·필터
- [ ] **상세** `orders/[id]/page.tsx`: Newrun 섹션, 검색 버튼, 발주/재발주, 택배 UI 분기
- [ ] **배송** `orders/shipping/page.tsx`: 뉴런 주문 배지·송장 편집 정책
- [ ] **반품** `orders/returns/page.tsx`: 안내 문구
- [ ] **API** `api/partner/orders*`: 확장 필드·재발주 엔드포인트

---

**변경 이력**

- 초안: 정상 결제 건 발주 연동, 수주화원·상품은 협회 `member_ext` + `var_ret` 우선, Mock 병행 전제.
- 추가: **파트너 Admin 주문 관리** (`/admin/orders`, `[id]`, `shipping`, `returns`) 수정·테스트 계획 및 Phase 8 세분화.
- Phase 0: `delivery-status`에 `HEAD`, `force-dynamic`, GET 쿼리 객체 로그 — T0.1 코드 완료 표기.
- Phase 1: `lib/newrun/*` — `rose_session`, 협회 검색 URL 빌더, 서버용 `build*UsingAppConfig` — `var_ret`는 Phase 2 콜백 경로를 가리킴(현재 404 가능).
- Phase 2: `callback/[kind]/route.ts`, `newrun_callback_results` 테이블, `postMessage` + JSON 테스트 모드.
- Phase 3: `GET /api/partner/integrations/newrun/search-url`, `request-app-origin.ts`, 어드민 주문 상세 뉴런 검색 카드 + `postMessage` 수신.
- Phase 4: `lib/newrun/map-order-to-newrun-payload.ts`, `GET /api/partner/orders/[id]/newrun-preview`, 주문 상세 미리보기·팝업/모바일 안내.
- Phase 5 정책: ViewPay 완료 직후 **자동 발주** 기본, 실패 시 **alert** + 어드민 **수동 발주** 병행(A+B). 인코딩·응답 파싱 등은 뉴런 피드백 후 확정.
- Phase 5 구현: `submit-order.ts`, `parse-intranet-post-response.ts`, `newrun-submit`·ViewPay 연동, 주문 DB 컬럼·어드민 UI.
