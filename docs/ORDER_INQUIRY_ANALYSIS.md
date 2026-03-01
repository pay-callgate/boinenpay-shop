# 주문 조회 화면 이슈 분석 및 수정 계획

**대상:** 기아자동차(knauto) 쇼핑몰 > 마이페이지 > 주문 조회  
**계정:** noblessneo@gmail.com  
**작성일:** 2026-02-10

---

## 1. 주문 내역이 비어 보이는 현상 (원인 분석)

### 1.1 동작 방식 요약

- **프론트:** `/{subdomain}/{clientSlug}/mypage/orders` 에서 `useShopTemplate()` 의 `client.id` 로  
  `GET /api/mypage/orders?clientId={client.id}&limit=50` 호출
- **API:** `app/api/mypage/orders/route.ts` 에서
  - `session.user.id`(NextAuth 세션 = **public.users.id**)
  - `clientId`(쿼리 파라미터 = 현재 거래처 **clients.id**)
  - 로 **orders** 테이블 조회:  
    `user_id = session.user.id` AND `client_id = clientId`

즉, **로그인한 사용자(public.users.id) + 현재 거래처(기아 client id)** 로만 필터링합니다.  
**user_clients(소속 기업)는 사용하지 않습니다.**

### 1.2 데이터가 안 나올 수 있는 원인 (우선순위)

| # | 원인 | 설명 | 확인 방법 |
|---|------|------|-----------|
| 1 | **orders.user_id 불일치** | Supabase `orders.user_id` 가 **public.users** 의 해당 사용자 UUID와 다름. 시드/수동 입력 시 **auth.users** ID나 다른 값을 넣었을 가능성. | Supabase에서 `users` 테이블에서 noblessneo@gmail.com 의 `id` 확인 후, `orders` 테이블의 `user_id` 와 일치하는지 확인. |
| 2 | **orders.client_id 불일치** | 주문이 다른 거래처(client)로 저장됨. 기아자동차(knauto) 의 **clients.id** 와 `orders.client_id` 가 다르면 목록에 안 나옴. | `clients` 테이블에서 slug='knauto' 인 행의 `id` 확인 후, `orders` 의 `client_id` 가 그 id인지 확인. |
| 3 | **세션 user.id 와 DB user_id 불일치** | NextAuth는 **public.users.id** 를 세션에 넣음. 예전에 주문만 **auth.users** id로 넣었다면 매칭 안 됨. | 위 1번과 동일. `session.user.id` = `public.users.id` 인지, 그리고 그 값이 `orders.user_id` 와 같은지 확인. |

### 1.3 코드 상으로 확인된 사항

- 주문 **생성** 시 (`app/api/orders/route.ts`):  
  `user_id: session.user.id`, `client_id: clientId` (요청 body) 사용 → **일관됨**
- 주문 **조회** 시 (`app/api/mypage/orders/route.ts`):  
  `user_id = session.user.id`, `client_id = clientId` 로 조회 → **동일한 기준**
- 따라서 **같은 앱에서 주문 생성 → 주문 조회** 라면 논리적으로는 목록에 나와야 함.  
  **Supabase에 직접/시드로 넣은 데이터**일 경우 위 1·2·3번 불일치 가능성이 큼.

### 1.4 수정 계획 (동의 후 진행)

1. **DB 검증 (우선 권장)**  
   - Supabase SQL 또는 대시보드에서:
     - `users` 에서 noblessneo@gmail.com 의 `id`
     - `clients` 에서 기아(knauto) 의 `id`
     - `orders` 에서 해당 `user_id`, `client_id` 로 행이 있는지 확인  
   - 불일치 시: `orders.user_id` 를 **public.users.id** 로, `orders.client_id` 를 **knauto의 clients.id** 로 맞춰 수정(시드/마이그레이션 스크립트 또는 수동 수정).

2. **선택: API 응답 디버깅**  
   - 일시적으로 `GET /api/mypage/orders` 응답에  
     `debug: { requestedClientId, sessionUserId }` (또는 마스킹된 일부) 추가해  
     실제로 어떤 id로 조회하는지 확인.  
   - 운영 반영 전 제거.

3. **로직 변경은 없음**  
   - 현재 설계(거래처 단위 조회 + 로그인 사용자)는 유지하고, **데이터 정합성**만 맞추는 방향 권장.

---

## 2. 주문 조회 탭이 모바일에서 잘리는 현상 (대응 방안)

### 2.1 현재 구조

- 탭 5개: 전체, 입금대기, 배송준비중, 배송중, 배송완료
- 상단 탭 영역: `overflow-x-auto` + 스크롤바 숨김(`scrollbarWidth: none` 등)
- 내부: `flex` + `shrink-0` + `whitespace-nowrap` 로 한 줄 고정

이론상 가로 스크롤은 가능하지만,  
- 스크롤바를 숨겨서 **스크롤 가능하다는 인지가 어렵고**,  
- 기종/뷰포트에 따라 **전체 페이지가 가로로 넓어져** 스크롤이 body 쪽으로 나가 탭만 스크롤되는 느낌이 안 날 수 있음.

### 2.2 제안 방안 (택 1 또는 조합)

| 방안 | 내용 | 장점 | 단점 |
|------|------|------|------|
| **A. 가로 스크롤 유지 + 스크롤 힌트** | 지금처럼 탭은 한 줄, `overflow-x-auto` 유지. 오른쪽 끝에 그라데이션(페이드) 또는 “더 보기” 아이콘으로 스크롤 가능함을 표시. | 구현 단순, 탭 수 늘어나도 대응 가능 | 작은 화면에서는 여전히 스와이프 필요 |
| **B. 모바일에서 탭 크기 축소** | 뷰포트 너비(예: max-w-[430px]) 또는 미디어 쿼리 기준으로 `text-xs` + `px-2 py-1.5` 등으로 패딩/폰트 축소해 5개가 한 화면에 들어가도록 조정. | 한 화면에 전부 노출, 스크롤 불필요 | 매우 작은 기기에서는 여전히 빡빡할 수 있음 |
| **C. A + B 조합** | 기본은 B로 5개가 들어가도록 하고, 들어가지 않는 해상도에서는 A처럼 가로 스크롤 + 페이드. | 대부분 한 화면, 예외만 스크롤 | 구현량 다소 증가 |

### 2.3 수정 계획 (동의 후 진행)

- **권장:** **C (조합)**  
  - 430px 이하(또는 `sm` 미만)에서 탭 폰트/패딩 축소해 5개가 보이도록 하고,  
  - 그래도 넘치면 `overflow-x-auto` + 오른쪽 그라데이션으로 스크롤 유도.
- **대상 파일:** `app/[subdomain]/[clientSlug]/mypage/orders/page.tsx`  
  - 상태별 탭 네비게이션 래퍼 및 버튼 스타일만 수정 (탭 키/라우팅 로직은 유지).

---

## 3. 다음 단계

1. **주문 비어 보이는 문제**  
   - 위 1.4의 DB 검증을 먼저 진행해 `user_id` / `client_id` 불일치 여부 확인.  
   - 필요 시 데이터 수정 후 재조회.  
   - 원하시면 API에 임시 디버그 필드 추가하는 수정안도 적용 가능합니다.

2. **탭 잘림 문제**  
   - 위 2.3대로 **C(조합)** 적용해, 모바일에서 자동 조정 + 필요 시 가로 스크롤되도록 수정할 수 있습니다.

**코드 수정은 위 계획에 대해 동의해 주시면 그에 맞춰 진행하겠습니다.**
