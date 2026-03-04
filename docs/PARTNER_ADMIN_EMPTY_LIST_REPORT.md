# 파트너 어드민 "등록된 상품/카테고리 없음" 원인 분석 리포트

**작성 일자:** 2026-02-10  
**현상:** 파트너 어드민 로그인 후(예: 7분 경과) 상품 관리·카테고리 관리·재고 관리 페이지에서  
"등록된 상품이 없습니다", "등록된 카테고리가 없습니다"만 표시됨.  
(레이아웃에는 "주식회사 우리부고", "Sanghee Lee님" 등 파트너·사용자 정보는 정상 표시)

---

## 1. 데이터 흐름 요약 (스냅샷 기준)

### 1.1 레이아웃(서버) vs 페이지(클라이언트)

| 단계 | 위치 | 동작 |
|------|------|------|
| 1 | **레이아웃** (`app/admin/(dashboard)/layout.tsx`) | **서버**에서 `getServerSession` → `partner_admins`(user_id) → `partner_id` → `partners` 조회. 파트너 없으면 `/admin/onboarding/partner` 리다이렉트. |
| 2 | **사이드바** | 레이아웃에서 조회한 `partnerDisplayName`(예: 주식회사 우리부고), `userName`(예: Sanghee Lee) 전달 → **정상 표시**되면 이 시점의 세션·파트너 조회는 성공한 것. |
| 3 | **상품/카테고리/재고 페이지** | **클라이언트** 컴포넌트. 마운트 시 `adminFetch("/api/partner")`로 `partnerId` 취득 후, 해당 `partnerId`로 `/api/products`, `/api/categories` 호출. |

→ **레이아웃에서 "주식회사 우리부고"가 보인다** = 해당 요청 시점에는 **세션 + partner_admins + partners** 조회가 성공했다는 의미.

### 1.2 빈 목록이 나올 수 있는 경우

1. **`/api/partner`가 `data: null`을 반환하는 경우**  
   - `partner_admins`에 해당 `session.user.id`에 대한 행이 없음.  
   - 또는 `partners`에 해당 `partner_id` 행이 없음.  
   - 이 경우 클라이언트는 `partnerId`를 설정하지 않아, `/api/products`, `/api/categories`를 호출하지 않거나 `partnerId` 없이 호출하면 400 → **목록은 빈 상태**.

2. **`/api/partner`는 정상 반환하지만, DB에 해당 `partner_id`로 등록된 상품/카테고리가 실제로 0건인 경우**  
   - 상품·카테고리·재고 API는 정상 동작하나, 조회 결과가 빈 배열 → **"등록된 상품/카테고리가 없습니다"** 메시지가 맞게 표시됨.

3. **Next/캐시 이슈**  
   - GET API나 페이지가 캐시되어 예전(빈) 응답이 반환되는 경우. 가능성은 상대적으로 낮음.  
   - 대응: API 라우트에 `export const dynamic = "force-dynamic"` 적용 및 로그로 실제 호출·응답 확인.

---

## 2. 세션 vs 데이터 vs Next 구분

- **세션 문제**로 보이는 경우:  
  - 레이아웃에서는 파트너명이 보이는데, **같은 탭에서** 상품/카테고리 페이지로 이동했을 때만 빈 목록이면,  
  - 클라이언트 요청 시 쿠키가 빠지거나, **`/api/partner` 호출이 401**이면 `adminFetch`가 로그인으로 보냄.  
  - 따라서 **로그인 유지된 채 빈 목록만 보인다**면, 세션은 유지된 상태이고 **`/api/partner`가 200이면서 `data: null`** 이거나, **`/api/products`, `/api/categories`가 빈 배열을 반환**하는 경우에 해당.

- **데이터 부재**로 보이는 경우:  
  - 해당 파트너(주식회사 우리부고)에 대해 `products`, `product_categories` 테이블에 **실제로 0건**이면, 메시지가 정상 동작.

- **Next/캐시**  
  - `dynamic = "force-dynamic"` 적용 후에도 동일하면, 위 두 가지(API가 null 반환 vs DB 0건) 중 하나로 압축됨.

---

## 3. 적용한 로깅 및 설정 (원인 확인용)

다음이 반영되어 있음.

| 대상 | 내용 |
|------|------|
| **`/api/partner`** | `dynamic = "force-dynamic"`. 401 시 `[API /api/partner] 401 - 세션 없음`. 성공 시 `userId`, `hasAdminRow`, `partnerId`, `adminError`. `data: null` 시 사유 로그. 200 시 `partnerId`, `company_name` 로그. |
| **`/api/products` GET** | `dynamic = "force-dynamic"`. 400 시 `partnerId 없음`. 200 시 `partnerId`, `total`, `page`, `limit` 로그. |
| **`/api/categories` GET** | `dynamic = "force-dynamic"`. 400 시 `partnerId 없음`. 200 시 `partnerId`, `count` 로그. |
| **레이아웃** | 기존 "파트너 권한 디버깅" 로그 유지 (`session.user.id`, `adminRow`, `partnerId`, `partner` 등). |

---

## 4. 확인 방법 (터미널 로그 기준)

1. **개발 서버 실행** 후 파트너 어드민 로그인 → 상품 관리(또는 카테고리/재고) 페이지로 이동.
2. **터미널**에서 다음 순서로 로그 확인:
   - **`=== 파트너 권한 디버깅 ===`**  
     - `session.user.id`, `adminRow`, `partnerId`, `partner` 가 채워져 있는지 확인.  
     - 채워져 있으면 **레이아웃 시점**에는 세션·파트너 조회 성공.
   - **`[API /api/partner]`**  
     - `userId`, `hasAdminRow`, `partnerId` 확인.  
     - `data: null` 사유 로그가 있으면 → **해당 user_id에 대한 partner_admins/partners 부재** 가능성.
     - `200`과 `partnerId`, `company_name`이 있으면 → **클라이언트는 정상적으로 partnerId를 받은 상태**.
   - **`[API /api/products] GET`** / **`[API /api/categories] GET`**  
     - `partnerId`가 레이아웃·`/api/partner`와 동일한지, `total`/`count`가 0인지 확인.  
     - `total`/`count`가 0이면 → **해당 파트너에 대한 상품/카테고리가 DB에 0건**일 가능성이 큼.

3. **정리:**
   - 레이아웃 디버깅 로그에 `partnerId` 있는데, **`[API /api/partner]`에서 `data: null`** → 클라이언트 요청만 세션/DB 불일치(가능성 낮음).  
   - **`[API /api/partner]` 200** 인데 **`[API /api/products]` / categories에서 `total`/`count`가 0** → **세션 문제가 아니라, 해당 파트너에 상품/카테고리 데이터가 없는 것**으로 결론 가능.  
   - **`[API /api/partner]`에서 `data: null`** 이고 `partner_admins에 해당 user_id 없음` 로그 → DB에 해당 사용자의 `partner_admins` 행이 없음(계정/역할 설정 점검 필요).

---

## 5. 결론 및 다음 액션

- **현상만으로는 "세션 처리 문제"라고 단정하기 어렵고**,  
  - 레이아웃에서 파트너명이 보이므로 **같은 요청에서 세션·파트너는 조회된 상태**이며,  
  - 빈 목록은 **(1) 클라이언트의 `/api/partner`가 null을 받거나, (2) 해당 파트너에 상품/카테고리가 0건**인 경우에 해당할 수 있음.

- **권장 확인 순서:**  
  1. 위 **터미널 로그**로 `/api/partner` 응답과 products/categories의 `partnerId`·`total`/`count` 확인.  
  2. **Supabase**에서 해당 파트너(주식회사 우리부고)의 `id`로 `products`, `product_categories` 건수 확인.  
  3. 로그에서 **`[API /api/partner] data: null`** 이 반복되면, `partner_admins` 테이블에 현재 로그인 사용자 `user_id`에 대한 행 존재 여부 확인.

- **추가 조치:**  
  - 원인 규명 후, 불필요한 "파트너 권한 디버깅" 로그는 제거해도 됨.  
  - API 로그는 원인 파악 후 유지 여부 결정.

이 문서는 **스냅샷(현재 코드·흐름) 기준** 원인 분석이며, 실제 원인은 터미널 로그와 DB 조회로 확정하는 것을 권장합니다.
