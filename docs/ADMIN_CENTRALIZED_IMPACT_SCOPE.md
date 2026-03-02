# 파트너 어드민 중앙 집중형 전환 — 영향 범위 검토

**목표:** 기존 서브도메인 분리형(`/{subdomain}/admin`) → 중앙 집중형(`/admin` 또는 `admin.calllink.com`) 전환 시 코드베이스 전체 영향 범위 정리.

**참고:** 쇼피파이 모델 — 어드민은 단일 URL, 소비자 쇼핑몰만 서브도메인(거래처 전용 URL) 유지.

---

## 1. 현재 구조 요약

| 구분 | 현재(PRD) | 비고 |
|------|------------|------|
| **어드민 접속** | `https://{subdomain}.shopping.com/admin` → 개발 시 `localhost:3000/{subdomain}/admin` | URL에 subdomain 포함 |
| **파트너 식별** | URL 경로 첫 세그먼트 = subdomain → DB `partners.subdomain`으로 조회 | 테넌트 = subdomain |
| **권한 검사** | (dashboard) layout에서 `partners.eq("subdomain", subdomain)` + `partner_admins.eq("partner_id", partner.id)` | 세션 user_id + subdomain으로 파트너 결정 |
| **클라이언트 API** | `GET /api/partner?subdomain={subdomain}` | subdomain 필수, 세션과 조합해 해당 파트너만 반환 |
| **거래처 쇼핑몰** | `/{subdomain}/{clientSlug}` | **변경 없음** (화이트라벨 유지) |

---

## 2. 영향 받는 영역 (체크리스트)

### 2.1 라우팅(파일 시스템)

| 현재 경로 | 전환 후 (예시) | 비고 |
|-----------|----------------|------|
| `app/[subdomain]/admin/` 전체 | `app/admin/` (또는 `app/(admin)/` 그룹) | **[subdomain] 세그먼트 제거** |
| `app/[subdomain]/admin/layout.tsx` | `app/admin/layout.tsx` | |
| `app/[subdomain]/admin/login/page.tsx` | `app/admin/login/page.tsx` | 단일 로그인 진입점 |
| `app/[subdomain]/admin/(dashboard)/layout.tsx` | `app/admin/(dashboard)/layout.tsx` | params에서 subdomain 제거, **session → partner_id** 사용 |
| `app/[subdomain]/admin/(dashboard)/**/*.tsx` | `app/admin/(dashboard)/**/*.tsx` | 모든 대시보드 페이지 이동 |
| `app/[subdomain]/admin/onboarding/` | `app/admin/onboarding/` | 기업 등록/온보딩 |

**영향 파일 수:** 약 21개 (admin 하위 페이지·레이아웃 전부).

---

### 2.2 미들웨어

| 파일 | 현재 역할 | 전환 시 |
|------|-----------|---------|
| `middleware.ts` | localhost 루트 → `/{DEFAULT_SUBDOMAIN}/` 리다이렉트; 프로덕션에서 `{sub}.shopping.com` → `/{sub}/...` rewrite | **어드민 경로는 제외**하거나, `/admin`은 rewrite 대상에서 빼기. (어드민이 중앙 도메인 전용이면 `admin.calllink.com` 등으로 분리 시 해당 호스트만 `/admin`으로 매핑) |

- 현재는 “경로 첫 세그먼트 = subdomain” 가정으로 동작.
- 중앙 어드민은 **경로에 subdomain이 없음** → `/admin`, `/admin/login` 등은 subdomain 리라이트/리다이렉트 대상에서 제외해야 함.

**현재 적용 (2026-02-10):** `/admin/login` 제외한 `/admin/*` 요청 시 `getToken()`으로 JWT 검사. 토큰 없으면 즉시 `/admin/login?callbackUrl=현재경로` 리다이렉트 (Layout보다 먼저 실행).

---

### 2.3 어드민 레이아웃·인증·파트너 해석

| 파일 | 현재 subdomain 사용처 | 전환 시 변경 |
|------|------------------------|-------------|
| `app/[subdomain]/admin/(dashboard)/layout.tsx` | `params.subdomain` → 로그인 리다이렉트 URL `/${subdomain}/admin/login`, `partners.eq("subdomain", subdomain)`, `partner_admins`로 권한 검사, `AdminHeader`/`AdminSidebar`에 subdomain 전달 | **params 대신 세션에서 partner_id 유도.** 로그인 URL은 `/admin/login`, 리다이렉트는 `?callbackUrl=/admin`. 파트너 조회: `partner_admins.eq("user_id", session.user.id)` → 1건 조회 후 `partner_id` 사용. (1인 1파트너 가정) |
| `app/[subdomain]/admin/onboarding/layout.tsx` | 동일하게 subdomain 기반 리다이렉트·Header/Sidebar | 동일하게 **세션 기반**으로 변경, subdomain 제거. |

**핵심:**  
- **현재:** URL subdomain → `partners` 1건 조회 → `partner_admins`로 “이 user가 이 partner 관리자 맞나?” 검사.  
- **전환:** 세션 user_id → `partner_admins` 1건 조회 → `partner_id` → `partners` 1건 조회. (subdomain은 **결과로 얻은** partner의 속성으로만 사용, URL에는 없음.)

---

### 2.4 API

| API | 현재 subdomain 사용 | 전환 시 변경 |
|-----|----------------------|-------------|
| `GET /api/partner` | 쿼리 `subdomain` 필수 → `partners.eq("subdomain", subdomain)` + `partner_admins`로 권한 확인 후 partner 반환 | **subdomain 제거.** 세션만으로 `partner_admins` → `partner_id` → `partners` 조회 후 반환. (또는 응답에 `subdomain` 포함해 프론트에서 “거래처 링크” 생성용으로만 사용) |
| `POST /api/partner/register` | body에 `subdomain` 받아서 `partners.subdomain` 저장 | **유지.** 파트너(상점) 식별자/쇼핑몰 URL용으로 여전히 필요. |
| `GET/PATCH /api/partner/orders/[id]` | 주문의 `partner_id`로 권한 검사 | **변경 없음.** 세션에서 partner_id를 쓰든, 기존처럼 주문 소유 partner_id와 비교만 하면 됨. |

---

### 2.5 프론트엔드(페이지·컴포넌트)

| 구분 | 파일(예시) | subdomain 사용처 | 전환 시 |
|------|------------|------------------|---------|
| **대시보드** | `(dashboard)/page.tsx`, `orders/page.tsx`, `products/page.tsx`, `clients/page.tsx`, `clients/links/page.tsx`, `categories/page.tsx`, `stats/*.tsx`, `orders/shipping/page.tsx`, `orders/returns/page.tsx`, `products/new/page.tsx`, `products/[id]/edit/page.tsx`, `products/inventory/page.tsx`, `notices/page.tsx`, `reviews/page.tsx` | `params.subdomain` → `fetch(\`/api/partner?subdomain=${subdomain}\`)`, `router.push(\`/${subdomain}/admin/...\`)`, 링크 `href={\`/${subdomain}/admin/...\`}` | **partner는 레이아웃/Context에서 세션 기반으로 1회 조회해 전달.** 각 페이지는 `partner`(또는 `partnerId`)만 사용. 내부 링크는 `/admin`, `/admin/orders` 등으로 통일. |
| **거래처/링크** | `clients/links/page.tsx` | `getStorefrontUrl(subdomain, slug)` 등 **쇼핑몰 URL 생성** | **partner.subdomain**은 API/레이아웃에서 받아서 사용. DB의 `partners.subdomain`은 그대로 두고, “이 파트너의 거래처 전용 URL” 생성용으로만 사용. |
| **로그인** | `admin/login/page.tsx` | `callbackUrl=/${subdomain}/admin` | `callbackUrl=/admin` 고정 (또는 쿼리로 전달). |
| **온보딩** | `onboarding/partner/page.tsx` | 성공 시 `/${subdomain}/admin`, 취소 시 `/${subdomain}/admin/login` | `/admin`, `/admin/login`으로 변경. `PartnerRegistrationForm`에 넘기던 subdomain은 “등록 시 입력하는 상점 subdomain(영문)”으로만 유지. |
| **공통 컴포넌트** | `AdminHeader.tsx` | `href=/${subdomain}/admin`, 로그아웃 `callbackUrl=/${subdomain}/admin/login` | `href=/admin`, `callbackUrl=/admin/login`. |
| | `AdminSidebar.tsx` | `base = /${subdomain}/admin`, 모든 메뉴 href, 상단 표시 `{subdomain}` | `base = /admin`. 상단에는 `partner.company_name` 또는 `partner.subdomain` 표시(선택). |
| | `PartnerRegistrationForm.tsx` | 기업 등록 시 subdomain 입력·검증 | **유지.** “쇼핑몰 URL용 subdomain” 입력은 그대로. |
| | `ClientRegistrationModal.tsx`, `ProductRegistrationModal.tsx` | subdomain prop으로 API/링크에 사용 | **partner from context**로 대체 가능. (필요 시 `partnerId`만 쓰고 subdomain은 서버/API에서만 사용.) |

---

### 2.6 테넌트/tenant 유틸

| 파일 | 현재 역할 | 전환 시 |
|------|-----------|---------|
| `lib/tenant.ts` | `getSubdomainFromRequest`, `getClientSlugFromPath`, `getTenantContext` | **어드민 경로**는 `isAdmin: true`만 두고, subdomain은 “쇼핑몰 경로”일 때만 추출하도록 유지. (admin.calllink.com 등 분리 시 호스트 기반 분기 추가 가능.) |

---

## 3. 변경하지 않는 부분 (유지)

- **거래처 쇼핑몰 URL:** `/{subdomain}/{clientSlug}` 및 해당 레이아웃·페이지·API. (PRD의 화이트라벨 정책 유지.)
- **DB 스키마:** `partners.subdomain` 필드 및 용도. (쇼핑몰 도메인/경로 생성용.)
- **미들웨어:** 쇼핑몰용 서브도메인 rewrite 규칙은 유지. (어드민만 예외 처리.)
- **NextAuth 설정:** 기존 provider/콜백 구조. (필요 시 세션에 `partner_id` 저장 확장.)

---

## 4. 세션·파트너 해석 정리 (전환 후)

- **로그인:** 단일 URL `https://admin.calllink.com` (또는 `https://calllink.com/admin`) → 동일 로그인 페이지.
- **로그인 후:**  
  - `partner_admins`에서 `user_id = session.user.id`인 행 1건 조회 → `partner_id` 획득.  
  - (선택) 세션 JWT에 `partner_id`를 넣어 두면 레이아웃/API에서 매번 DB 조회 생략 가능.
- **대시보드/API:**  
  - 모든 데이터는 `partner_id`(세션에서 유도)로만 필터.  
  - “거래처 링크” 등 노출용 URL만 `partners.subdomain`을 사용해 `https://{subdomain}.shopping.com/{clientSlug}` 형태로 생성.

---

## 5. 파일 단위 영향 요약

| 카테고리 | 경로/파일 | 조치 |
|----------|-----------|------|
| **라우팅** | `app/[subdomain]/admin/**` 전부 | `app/admin/**`로 이전, `[subdomain]` 제거 |
| **레이아웃** | `admin/(dashboard)/layout.tsx`, `admin/onboarding/layout.tsx` | 파트너 해석을 **세션 → partner_id** 기준으로 변경, 리다이렉트 경로를 `/admin`, `/admin/login`으로 통일 |
| **API** | `app/api/partner/route.ts` (GET) | subdomain 쿼리 제거, 세션으로 partner 조회 |
| **컴포넌트** | `AdminHeader`, `AdminSidebar` | 링크/로그아웃을 `/admin` 기준으로, subdomain prop 제거 후 partner(또는 base path)만 사용 |
| **페이지** | 위 2.5에 열거한 모든 admin 페이지 | `params.subdomain` 제거, `partner`/`partnerId`는 레이아웃·Context·API에서 제공, 내부 이동 경로는 `/admin/...` |
| **미들웨어** | `middleware.ts` | `/admin`(및 필요 시 admin 전용 호스트)은 subdomain rewrite 제외 |
| **온보딩/폼** | `PartnerRegistrationForm`, onboarding 페이지 | 등록 시 “subdomain” 입력은 유지(쇼핑몰 URL용), 리다이렉트만 `/admin` 기준으로 변경 |

---

## 6. 정리

- **변경 범위:** 어드민 **라우팅·레이아웃·인증 분기·API(GET /api/partner)·공통 컴포넌트·각 대시보드 페이지**가 모두 영향 받음.  
- **유지 범위:** **쇼핑몰(거래처 전용 URL), `partners.subdomain` 의미·용도, 미들웨어의 쇼핑몰 rewrite.**  
- **핵심 설계 전환:** “테넌트 = URL의 subdomain” → “테넌트 = 세션에서 유도한 partner_id” (어드민만 해당).

이 문서는 “중앙 집중형 어드민 + 쇼핑몰만 서브도메인” 전환 시 **현재 코드베이스의 전체 영향 범위**를 정리한 검토 자료입니다.
