# 에러 원인 분석 및 수정 계획 (통합)

이 문서에는 **지금부터 발생하는 모든 에러**에 대한 원인 분석과 수정 계획을 기록합니다.  
새 에러가 발생할 때마다 이 파일에만 항목을 추가해 주세요.

---

## 1. 주문 상세 페이지 — `Cannot read properties of undefined (reading 'id')`

### 1.1 에러 개요

| 항목 | 내용 |
|------|------|
| **에러 타입** | `Runtime TypeError` |
| **에러 메시지** | `Cannot read properties of undefined (reading 'id')` |
| **발생 파일** | `app/[subdomain]/[clientSlug]/mypage/orders/[id]/page.tsx` |
| **발생 라인** | 85번째 줄 |
| **문제 코드** | `setPartnerId(data.partner.id)` (함수: `fetchPartnerId`) |

### 1.2 에러 발생 원인 분석

**직접 원인**

- `res.ok === true`인 경우 `res.json()`으로 파싱한 `data`에 대해 **`data.partner.id`** 를 사용하고 있음.
- API가 `{ partner: undefined }` 또는 `partner` 없이 다른 형태로 응답하면 `data.partner`가 `undefined`가 되고, 이 상태에서 `.id`를 읽으면서 **`Cannot read properties of undefined (reading 'id')`** 가 발생함.

**구조적 원인 (레거시 패턴)**

- **중복 조회:** 레이아웃에서 이미 **ShopTemplateContext**로 `partner` / `client`를 주입하고 있는데, 주문 상세 페이지에서만 **별도로** `/api/partner?subdomain=...` 를 호출해 `partnerId`를 다시 가져오고 있음.
- **불필요한 상태:** `partnerId`를 로컬 state로 관리하면서, Context와 이중으로 파트너 정보를 의존하는 구조가 됨.
- **방어 로직 부재:** `data.partner` 존재 여부를 검사하지 않고 `data.partner.id`에 바로 접근하고 있어, API 응답 형태가 바뀌거나 실패 시 런타임 에러가 발생함.

**참고: 동일 패턴의 기존 수정 사례**

- **마이페이지 > 회원정보** (`mypage/profile/page.tsx`): 동일한 `fetchPartnerId` + `setPartnerId(data.partner.id)` 패턴으로 에러 발생 → **Context 사용 + fetch 제거**로 해결함.
- **마이페이지 > 주문 목록** (`mypage/orders/page.tsx`): 이미 **useShopTemplate()** 만 사용하고, 별도 파트너 fetch 없이 동작 중.

### 1.3 수정 계획

**목표**

- 주문 상세 페이지에서 **Context 기반**으로만 partner/client를 사용하고, **파트너 전용 fetch 제거**로 에러를 근본적으로 제거.
- `partnerId` state 제거 후 **OrderGuard**에는 Context의 `partner.id`만 전달.

**수정 항목**

| 단계 | 대상 | 수정 내용 |
|------|------|-----------|
| 1 | **중복 fetch 제거** | `fetchPartnerId` useEffect 전체 삭제. `/api/partner` 호출 및 `partnerId` state 제거. |
| 2 | **Context 활용** | 상단에서 `useShopTemplate()` 호출 후 `partner`, `client` 사용. |
| 3 | **방어 로직** | `template == null` 또는 `!partner` 또는 `!client`일 때 로딩 UI만 렌더 후 early return. Context 주입 전 API/렌더로 인한 크래시 방지. |
| 4 | **주문 상세 API 연동** | 주문 상세 조회 `useEffect`의 의존성에 `partner?.id`, `client?.id` 포함. Context 준비된 뒤에만 `/api/orders/[id]` 호출. (필요 시 쿼리에 `clientId` 전달해 테넌트 격리 유지) |

**수정 후 흐름 (의사 코드)**

```ts
// 1. Context에서 partner, client 취득
const template = useShopTemplate();
const partner = template?.partner ?? null;
const client = template?.client ?? null;

// 2. Context 미준비 시 로딩만 표시
if (template == null || !partner || !client) {
  return <로딩 UI>;
}

// 3. 주문 상세 조회는 client.id 등 준비된 뒤 실행
useEffect(() => {
  if (!orderId || !client?.id) return;
  fetch(`/api/orders/${orderId}`)...
}, [orderId, client?.id]);

// 4. OrderGuard에는 partner.id만 전달
<OrderGuard partnerId={partner.id}>
```

**기대 효과**

- **에러 제거:** `data.partner` 미존재로 인한 런타임 에러 제거.
- **일관성:** 주문 목록·회원정보 페이지와 동일한 Context 기반 구조로 통일.
- **유지보수:** 파트너/클라이언트 정보는 한 곳(ShopTemplateContext)에서만 관리.

**적용 대상 파일**

- **수정 파일:** `app/[subdomain]/[clientSlug]/mypage/orders/[id]/page.tsx`
- **참고 (이미 적용됨):** `mypage/profile/page.tsx`, `mypage/orders/page.tsx`

---

## 2. 마이페이지 > 회원정보 — 500 "사용자 정보 조회 실패" 및 Fallback UI

### 2.1 에러 개요

| 항목 | 내용 |
|------|------|
| **증상** | 회원정보 클릭 시 "사용자 정보를 불러올 수 없습니다" Fallback UI 표시, 콘솔에 2건 이슈 |
| **프론트 로그** | `[mypage/profile] 조회 실패: 500 "사용자 정보 조회 실패"` |
| **발생 파일** | 프론트: `mypage/profile/page.tsx` (52행 console.error) / 백: `app/api/mypage/profile/route.ts` |
| **HTTP 상태** | GET `/api/mypage/profile?clientId=xxx` → 500 |

### 2.2 에러 발생 원인 분석

**직접 원인**

- 백엔드 GET 처리 중 **users 테이블 조회**에서 Supabase가 `error`를 반환하고 있음.
- API는 `userError`가 있으면 500과 "사용자 정보 조회 실패"를 반환하며, 프론트는 `res.ok === false`일 때 위 로그를 남기고 Fallback UI를 띄움.

**가능한 구조적 원인**

1. **스키마 불일치:** `users` 테이블에 **avatar_url** 컬럼이 없는데 API에서 `.select("id, name, email, phone, avatar_url")`로 조회하는 경우, Supabase가 존재하지 않는 컬럼으로 인해 에러를 반환할 수 있음. (마이그레이션에 따라 users에는 id, email, name, phone, role 등만 있고 avatar_url이 없을 수 있음.)
2. **권한 검사 통과 후 users 조회 실패:** user_clients/orders 권한 검사는 통과했지만, 그 다음 `users` 조회 단계에서만 실패하는 경우(예: 컬럼명 오타, RLS 등) 500이 발생함.

### 2.3 수정 계획

**목표**

- 500 원인 제거: users 조회가 실패하지 않도록 스키마에 맞는 컬럼만 조회.
- 정상 유저가 Fallback UI를 보지 않도록 함.

**수정 항목**

| 단계 | 대상 | 수정 내용 |
|------|------|-----------|
| 1 | **API users 조회** | `.select()`에서 **avatar_url** 제거. 스키마에 확실히 있는 컬럼만 사용: `id, name, email, phone`. (avatar_url이 마이그레이션에 추가된 경우 이후 다시 포함 가능.) |
| 2 | **에러 완화** | users 조회 시 `userError`가 있어도, "레코드 없음"에 가까운 경우(예: PGRST116)는 500 대신 `{ user: {} }` 반환 검토. (선택) |
| 3 | **프론트** | 이미 clientId 전달·에러 로깅 적용됨. API 수정으로 500이 사라지면 Fallback UI 미노출. |

**적용 대상 파일**

- **수정 파일:** `app/api/mypage/profile/route.ts` (GET/PUT의 users select에서 avatar_url 제거 또는 스키마와 일치하도록 조정)

---

## 3. 마이페이지 > 관심상품 — `Cannot read properties of undefined (reading 'id')` (로딩 불가)

### 3.1 에러 개요

| 항목 | 내용 |
|------|------|
| **에러 타입** | `Runtime TypeError` |
| **에러 메시지** | `Cannot read properties of undefined (reading 'id')` |
| **발생 파일** | `app/[subdomain]/[clientSlug]/mypage/wishlist/page.tsx` |
| **발생 라인** | 51번째 줄 |
| **문제 코드** | `setPartnerId(partnerData.partner.id)` (함수: `fetchData`) |

### 3.2 에러 발생 원인 분석

**직접 원인**

- `partnerRes.ok === true`인데 `partnerData.partner`가 **undefined**인 경우가 있음.
- 이 상태에서 `partnerData.partner.id`에 접근하면서 런타임 에러 발생 → 관심상품 페이지가 로딩되지 않음.

**구조적 원인 (레거시 패턴)**

- **중복 조회:** ShopTemplateContext로 이미 partner/client를 제공하는데, 관심상품 페이지만 `/api/partner` + `/api/clients`를 호출해 partnerId/clientId를 따로 조회하고 있음.
- **방어 로직 부재:** `partnerData.partner` 존재 여부를 검사하지 않고 `.id` 접근.

### 3.3 수정 계획

**목표**

- 주문 상세·회원정보와 동일하게 **useShopTemplate()** 기반으로 전환.
- 파트너/거래처 전용 fetch 제거 후 Context의 `partner`, `client`만 사용.

**수정 항목**

| 단계 | 대상 | 수정 내용 |
|------|------|-----------|
| 1 | **중복 fetch 제거** | `/api/partner`, `/api/clients` 호출 및 `partnerId`, `clientId` state 제거. |
| 2 | **Context 활용** | `useShopTemplate()`로 `partner`, `client` 취득. |
| 3 | **방어 로직** | `template == null` 또는 `!partner` 또는 `!client`일 때 로딩 UI만 표시 후 early return. |
| 4 | **API 연동** | 관심상품 목록/삭제 호출 시 Context의 `client.id` 사용 (이미 clientId 필수인 API와 동일). |

**적용 대상 파일**

- **수정 파일:** `app/[subdomain]/[clientSlug]/mypage/wishlist/page.tsx`

---

## 4. 마이페이지 > 배송주소록 관리 — `Cannot read properties of undefined (reading 'id')` (로딩 불가)

### 4.1 에러 개요

| 항목 | 내용 |
|------|------|
| **에러 타입** | `Runtime TypeError` |
| **에러 메시지** | `Cannot read properties of undefined (reading 'id')` |
| **발생 파일** | `app/[subdomain]/[clientSlug]/mypage/addresses/page.tsx` |
| **발생 라인** | 56번째 줄 |
| **문제 코드** | `setPartnerId(data.partner.id)` (함수: `fetchPartnerId`) |

### 4.2 에러 발생 원인 분석

**직접 원인**

- `res.ok === true`인데 응답 body에 **`data.partner`**가 없거나 `undefined`인 경우가 있음.
- 이 상태에서 `data.partner.id`에 접근하면서 런타임 에러 발생 → 배송주소록 관리 페이지가 로딩되지 않음.

**구조적 원인 (레거시 패턴)**

- **중복 조회:** 레이아웃의 **ShopTemplateContext**에서 이미 partner/client를 제공하는데, 이 페이지만 **별도로** `/api/partner?subdomain=...`를 호출해 `partnerId`를 조회하고 있음.
- **방어 로직 부재:** `data.partner` 존재 여부를 검사하지 않고 `.id`에 바로 접근함.
- **추가 이슈:** 배송지 목록 조회 `fetchAddresses()`가 `useEffect(() => { fetchAddresses(); }, [])`로 마운트 시 무조건 호출되며, 현재 `/api/mypage/addresses`는 `clientId`를 받지 않음. (다른 마이페이지 API들은 테넌트 격리로 clientId 필수. 추후 API 정책 통일 시 clientId 전달 필요할 수 있음.)

### 4.3 수정 계획 (코드 수정 동의 후 적용)

**목표**

- 주문 상세·회원정보·관심상품과 동일하게 **useShopTemplate()** 기반으로 전환.
- 파트너 전용 fetch 제거 후 Context의 `partner`, `client`만 사용해 에러 제거.

**수정 항목**

| 단계 | 대상 | 수정 내용 |
|------|------|-----------|
| 1 | **중복 fetch 제거** | `fetchPartnerId` useEffect 전체 삭제. `/api/partner` 호출 및 `partnerId` state 제거. |
| 2 | **Context 활용** | `useShopTemplate()`로 `partner`, `client` 취득. |
| 3 | **방어 로직** | `template == null` 또는 `!partner` 또는 `!client`일 때 로딩 UI만 표시 후 early return. |
| 4 | **배송지 API 연동** | `fetchAddresses` 호출 시점을 Context 준비 이후로 이동. (배송지는 통합 배송지 정책으로 clientId 미사용 → URL 변경 없음.) |
| 5 | **OrderGuard** | `partnerId={partner.id}` 로 Context의 partner 사용. |

**📌 테넌트 격리 정책 (비즈니스 결정)**

- 배송 주소록은 **유저의 공통 정보(통합 배송지)**로 취급하기로 함.
- 따라서 `/api/mypage/addresses`에 **clientId를 추가하거나 테넌트 격리 로직을 넣지 않음**.
- 프론트엔드만 `useShopTemplate()`으로 Context 기반 렌더링하여 화면이 뻗지 않게 처리.

**적용 대상 파일**

- **수정 파일:** `app/[subdomain]/[clientSlug]/mypage/addresses/page.tsx` (프론트만 수정)
- **백엔드:** `app/api/mypage/addresses/route.ts` — 변경 없음 (clientId 미사용 유지)

---

*이후 발생하는 에러는 위와 같은 형식으로 이 문서에 **5. ...**, **6. ...** 항목을 추가해 기록합니다.*
