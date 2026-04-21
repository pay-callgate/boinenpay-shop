# 뉴런시스템(Newrun) 발주연동 — 개발 계획 및 체크리스트

**문서 목적:** 
정상 결제(`payment_status = paid`) 건을 협회(가입 협회)로 발주 연동하기 위한 단계별 개발·테스트·검수 항목을 정리한다.  
**참고 규격:** `발주연동 서비스 - 개발참고문서 (V1.1)` (㈜뉴런시스템) — 발주(2.1), 수주화원 검색(2.2), 상품 검색(2.3), 옵션(2.4), 배송상태(2.6) 등.  
**코드·URL 네이밍:** `neuron`이 아닌 **`newrun`** 사용.

---

## 0. 전제·범위

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
| `NEWRUN_ASSOC_BASE_URL` | 협회 인트라넷 베이스 URL (예: `https://www.kot45.com`) |
| `NEWRUN_ASSOC_INTRANET_ID` | `rose_session`용 base64에 넣는 발주화원 인트라넷 아이디 |
| `NEWRUN_ROSEWEB_ID` / `NEWRUN_ROSEWEB_PW` | 발주(2.1) `rw_rosewebid`, `rw_rosewebpw` (뉴런 통보명과 일치시킬 것) |
| `NEWRUN_ASSOC_CODE` | `rw_assoc` |
| `NEWRUN_INTRANET_POST_URL` | 기본값 `http://ext2intra.roseweb.co.kr/intranet_post.html` — **최신 URL 뉴런 확인** |

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

- [ ] **T1.1** `lib/newrun/rose-session.ts` (또는 동일 역할 모듈):  
  `base64(time) + "DiV" + md5(time) + "DiV" + base64(인트라넷ID)` (PHP 예제와 동일 결과인지 **샘플로 검증**)
- [ ] **T1.2** `buildMemberSearchUrl`, `buildProductSearchUrl`, (선택) `buildOptionSearchUrl` — `callroseweb=ext_home`, `rose_session`, `var_ret`(절대 URL) 조립
- [ ] **T1.3** `var_ret` 베이스는 `getBaseUrl()` 등 **앱 공통 origin** 사용 (문서: `docs/DEPLOYMENT_CHECKLIST.md` 의 `NEXT_PUBLIC_APP_URL` 정합)
- [ ] **T1.4** 단위 테스트 또는 스크립트: 동일 입력 → 동일 `rose_session` (타임 의존 시 mock time)

### 테스트·체크리스트

- [ ] 로컬에서 생성된 URL을 브라우저에 붙여 **협회 페이지가 열리는지** (세팅 완료 후)
- [ ] `var_ret`가 잘못된 도메인이 아닌지(프로덕션/스테이징 구분)

---

## Phase 2 — `var_ret` 콜백 수신 (수주화원·상품·옵션)

**목표:** 협회 팝업에서 선택 후 돌아오는 파라미터를 수신하고, 발주 폼/어드민과 연계 가능한 형태로 저장.

### Tasks

- [ ] **T2.1** 라우트 설계 (예):  
  - `GET` (또는 POST) `/api/integrations/newrun/callback/florist`  
  - `.../callback/product`  
  - (필요 시) `.../callback/option`  
  실제 파라미터명은 **협회 응답(문서 2.2.3, 2.3.3)** 과 대조하여 확정
- [ ] **T2.2** 수신 값 파싱: `var_sid`(수주화원 ID) 등 → **짧은 TTL 저장**(DB 임시 테이블 또는 서버 세션 불가 시 **서명된 state 토큰** + Redis/DB)
- [ ] **T2.3** (선택) 팝업 → 부모 창: `postMessage` 또는 리다이렉트로 어드민/체크아웃에 ID 전달
- [ ] **T2.4** CSRF·스푸핑 완화: 콜백 URL에 **일회용 토큰** 또는 뉴런과 **공유 시크릿** 협의 시 검증

### 테스트·체크리스트

- [ ] 협회 팝업에서 선택 후 **실제로 콜백 URL이 호출되는지**
- [ ] 수신 로그/DB에 `var_sid` 등 기대 필드가 들어오는지
- [ ] 잘못된 토큰/만료 토큰 거부 동작

---

## Phase 3 — 선택 UX (수주화원·상품)

**목표:** 문서 2.2·2.3(·2.4) 패턴 — **협회 호스트 UI**를 열고 결과를 주문 발주 데이터에 반영.

### Tasks

- [ ] **T3.1** **주문 상세** (`app/admin/(dashboard)/orders/[id]/page.tsx`)에 **「수주화원 검색」** 버튼 → `window.open(buildMemberSearchUrl(...))` (또는 동일 기능 모듈)
- [ ] **T3.2** 동일 화면에 **「상품 검색」**(필요 시 **옵션 상품 검색**) 버튼
- [ ] **T3.3** 콜백으로 받은 `rw_sujuid` / `rw_menucode`(및 옵션 필드)를 **주문 발주 draft** 또는 `orders` 확장 컬럼에 저장
- [ ] **T3.4** 폴백: 거래처·상품별 **기본 수주화원·기본 상품코드**(DB/설정) — 팝업 없이 발주 가능
- [ ] **T3.5** (선택) 고객 체크아웃에 노출할지 **정책 결정** — 1차는 **어드민 주문 상세**만 권장

### 테스트·체크리스트

- [ ] 데스크톱 브라우저: 팝업 차단 시 안내
- [ ] 모바일: 팝업/인앱브라우저 이슈 — `lib/kakao-in-app-browser.ts` 등 기존 패턴 참고 여부 검토
- [ ] 기본값만으로 발주 POST가 가능한지(스모크)

---

## Phase 4 — 주문 데이터 → `rw_*` 매핑 (2.1.3)

**목표:** `orders`, `order_items`, 배송·리본·시간 등을 뉴런 필드 길이·필수·형식에 맞게 변환.

### Tasks

- [ ] **T4.1** `lib/newrun/map-order-to-newrun-payload.ts` (예시명): 입력 `order` + `items` + 선택된 `sujuid`/`menucode`/옵션  
  출력 `Record<string, string | number>` (또는 `URLSearchParams`)
- [ ] **T4.2** 필수: `rw_sender=100`, `rw_style=0`, `rw_method`, `rw_sno`(쇼핑몰 고유번호), `rw_returnurl`, `rw_rosewebid`, `rw_rosewebpw`, `rw_sendsms`/`rw_sendfax`, `rw_price`, `rw_aname`, `rw_atel`, `rw_arrive_place1`, `rw_bdate` 등 — **문서 표와 1:1 체크**
- [ ] **T4.3** 숫자 필드: 콤마 제거, int 범위
- [ ] **T4.4** `rw_sno` 정책: `order_no` 또는 `order_id` — **멱등·중복(결과코드 20)** 정책 문서화
- [ ] **T4.5** `shipping_detail` 텍스트(비회원 화환 등) → `rw_memo` / `rw_shopreq` 등 분할 규칙

### 테스트·체크리스트

- [ ] 샘플 주문 JSON → 매핑 결과 스냅샷 테스트(길이 초과 시 truncate 정책)
- [ ] 필수 누락 시 발주 전 **검증 에러** 반환

---

## Phase 5 — 발주 전송 `intranet_post` (2.1)

**목표:** 정상 결제 건에 대해 뉴런 게이트웨이로 발주 요청 전송 및 결과 처리.

### Tasks

- [ ] **T5.1** `lib/newrun/submit-order.ts`: `NEWRUN_MOCK`이면 외부 미호출, 고정 `rwr_result` 시뮬레이션
- [ ] **T5.2** 실연동: `fetch` POST — `Content-Type`, **문자 인코딩(EUC-KR vs UTF-8)** 뉴런·실측에 맞춤
- [ ] **T5.3** 응답 파싱: `rwr_result`, `rwr_orderkey` 등 — 리다이렉트/HTML 본문인지 **실측**
- [ ] **T5.4** DB: 발주 성공 시 `neuron_order_key`(예: `rwr_orderkey`), 실패 시 결과코드·메시지 저장
- [ ] **T5.5** **트리거:**  
  - 옵션 A: `app/api/payment/viewpay/complete` 처리 후 **비동기 큐**(또는 `after` API)에서 발주  
  - 옵션 B: 어드민 **「발주 실행」** 수동 + 자동 보조  
  선택 후 구현
- [ ] **T5.6** **멱등:** 동일 `rw_sno` 재전송 시 코드 20 처리 — 사용자 메시지·재시도 정책

### 테스트·체크리스트

- [ ] `NEWRUN_MOCK=true`로 E2E: 결제 완료 → 발주 레코드 갱신
- [ ] 스테이징 + `NEWRUN_ENABLED=true`: 실제 **결과코드 0** 확인
- [ ] 실패 코드 2,3,11… 등 **어드민 표시·재시도** 확인

---

## Phase 6 — 발주 리턴 페이지 고도화 (`po-return`)

**목표:** 브라우저 리턴 시 `rwr_*`를 DB에 반영하고 사용자에게 명확한 메시지 표시.

### Tasks

- [ ] **T6.1** 서버 액션 또는 `GET`에서 토큰과 함께 주문 ID 매칭 후 `orders` 업데이트
- [ ] **T6.2** 성공/실패 UI 분기 (`rwr_result` 문서 2.1.5)
- [ ] **T6.3** `order_status_history` 또는 발주 전용 이력 테이블 기록

### 테스트·체크리스트

- [ ] 시뮬레이션 쿼리로 성공·실패 화면 확인
- [ ] DB 반영 후 어드민 주문 상세와 일치

---

## Phase 7 — 배송상태 콜백 (2.6)

**목표:** `oid`, `state`(2/3/4), `ordercode` 등 수신 → 내부 주문 상태·이력 반영.

### Tasks

- [ ] **T7.1** `delivery-status` 라우트에서 파라미터 매핑 (GET/POST 모두 — 뉴런 통보 방식에 맞춤)
- [ ] **T7.2** `oid` ↔ `orders` 조회 (`order_no` 또는 저장한 `rw_sno`)
- [ ] **T7.3** `state` → 내부 `orders.status` / fulfillment 매핑표 적용 (문서: 2=주문접수, 3=배송중, 4=배송완료)
- [ ] **T7.4** 인수 정보·이미지 URL 등 확장 필드 저장
- [ ] **T7.5** 출처 검증(IP 허용목록 등) 뉴런 협의 시 적용

### 테스트·체크리스트

- [ ] Postman 등으로 샘플 payload 전송 → 상태·이력 갱신
- [ ] 존재하지 않는 `oid` 시 200 vs 404 정책 (뉴런 재시도 고려)

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
| 1 | rose_session / URL | [ ] | [ ] | |
| 2 | var_ret 콜백 | [ ] | [ ] | |
| 3 | 선택 UX | [ ] | [ ] | |
| 4 | 매핑 | [ ] | [ ] | |
| 5 | 발주 전송 | [ ] | [ ] | Mock→실연동 |
| 6 | po-return 고도화 | [ ] | [ ] | |
| 7 | 배송 콜백 | [ ] | [ ] | |
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
