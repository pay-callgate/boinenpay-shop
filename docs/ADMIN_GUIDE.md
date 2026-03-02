# Admin 가이드 (병합 문서)

**병합 소스:** PARTNER_ADMIN_ACCESS_CHECKLIST, PARTNER_REGISTRATION_FIX_GUIDE, MOBILE_SHOP_LOGIN_FIX  
**최종 수정:** 2026-02-10

---

## 목차

1. [Part 1. 파트너 어드민 접속 플로우](#part-1-파트너-어드민-접속-플로우)
2. [Part 2. 파트너 등록 API 수정 및 DB 마이그레이션](#part-2-파트너-등록-api-수정-및-db-마이그레이션)
3. [Part 3. 모바일 쇼핑몰 로그인 수정](#part-3-모바일-쇼핑몰-로그인-수정)
4. [Part 4. 어드민 보안 정책 (1시간 세션 + 유휴 감지)](#part-4-어드민-보안-정책-1시간-세션--유휴-감지)

---

## Part 1. 파트너 어드민 접속 플로우

**대상:** 시드 데이터 없이 구글 계정으로 직접 회원가입 → 파트너 어드민 접속

### 1. 인증 플로우 (NextAuth.js)

- 구글/카카오/네이버 OAuth, 로그인 시 `public.users` 자동 insert/update, `provider`/`provider_id` 기반 식별, 초기 role `end_customer`.

**진입 조건:** 세션 존재 → 파트너 존재(subdomain) → `partner_admins` 매핑 → `partners.verification_status='verified'`. 미충족 시 `/admin/onboarding/partner` 리다이렉트.

### 2. 기업 등록 플로우

- 기업 정보 입력 폼 → 사업자번호 검증 → 기업 등록 (POST `/api/partner/register`) → `partners`/`partner_admins` insert, `users.role` → `partner_admin`.

### 3. 필수 환경 변수

- `GOOGLE_CLIENT_ID`: Google Cloud Console 발급 Client ID (이메일 아님)
- `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL=http://localhost:3000`, `NEXTAUTH_SECRET` (32바이트 랜덤)
- Redirect URI: `http://localhost:3000/api/auth/callback/google`

### 4. 발견된 이슈 및 해결 요약

| Issue | 원인 | 해결 | 상태 |
|-------|------|------|------|
| #1 OAuth Redirect URI 불일치 | Google Console 미등록 | Redirect URI 추가 | ✅ |
| #2 Subdomain 불일치 | middleware DEFAULT_SUBDOMAIN | `testpartner`로 변경 | ✅ |
| #3 Tailwind CSS 미적용 | [subdomain] layout 누락 | `[subdomain]/layout.tsx` 생성, CSS import | ✅ |
| #4 Google OAuth 400 | Supabase URI 충돌 추정 | Supabase Redirect URI 제거 등 | 🔧 |
| #5 Tailwind content 비어있음 | tailwind.config.js content: [] | content 배열 채움 | ✅ |
| #6 UI 페이지→모달 | UX 요청 | Dialog + Form 분리 | ✅ |
| #7 API 400 (필드명) | email vs representativeEmail | API·DB 수정 | ✅ |

*(상세 이슈 내역·재현 절차는 원본 PARTNER_ADMIN_ACCESS_CHECKLIST.md 참고)*

---

## Part 2. 파트너 등록 API 수정 및 DB 마이그레이션

**목적:** 400 Bad Request 해결 및 신규 필드 지원

### 문제 원인

- API 필수 검증: `email` / 프론트 전송: `representativeEmail` → 불일치로 400.

### 해결 요약

1. **API** (`app/api/partner/register/route.ts`): 구조 분해에 `representativeEmail`, `representativeContact` 등 반영, 필수 검증을 `representativeEmail`로, Insert 시 `email: representativeEmail`, `contact: representativeContact` 매핑.
2. **DB:** `partners` 테이블에 `franchise_name`, `corporate_registration_number`, `representative_dob` 컬럼 추가 (Supabase SQL Editor 또는 마이그레이션 파일 실행).
3. **테스트:** 서버 재시작 후 등록 폼 제출 → 200 OK, 대시보드 이동, Supabase 데이터 확인.

*(상세 코드 스니펫·SQL·트러블슈팅은 원본 PARTNER_REGISTRATION_FIX_GUIDE.md 참고)*

---

## Part 3. 모바일 쇼핑몰 로그인 수정

**현상:** 모바일에서 `/{sub}/{clientSlug}` 접속 시 로그인 유도 화면만 노출, PC에서는 쇼핑몰 정상.  
**요구:** 비로그인에서도 메인/PLP/PDP 노출, 로그인 유도 시 거래처 로그인 UI를 어드민 로그인과 동일 스타일로.

### 원인

- 메인 페이지에서 `status === "unauthenticated"`일 때 무조건 로그인 화면만 렌더링.
- 쇼핑몰 쪽 로그인 유도 UI가 어드민 로그인 페이지와 별도 구현.

### 수정 요약

1. **메인 페이지** (`app/[subdomain]/[clientSlug]/page.tsx`): `unauthenticated`일 때 로그인 화면 반환 분기 제거 → 항상 ShopLayout + ShopMainHome 렌더링(로딩/에러 제외).
2. **OrderGuard** (`components/shop/OrderGuard.tsx`): 미로그인 시 "로그인" 클릭 시 `signIn()` 대신 `router.push(\`/${subdomain}/admin/login?callbackUrl=...\`)` 로 어드민 로그인 페이지 사용.

*(상세 검증 포인트·프롬프트는 원본 MOBILE_SHOP_LOGIN_FIX.md 참고)*

---

## Part 4. 어드민 보안 정책 (1시간 세션 + 유휴 감지)

**목적:** 서버 부하 절감 및 보안 강화. 장시간 비활동 시 세션 종료로 리소스 절약.

### 4.1 세션 만료 시간

- **lib/auth.ts:** `session.maxAge = 60 * 60` (1시간 = 3,600초)
- NextAuth JWT 전략 적용. 1시간 경과 시 세션 무효화.

### 4.2 유휴 시간 감지 및 자동 로그아웃

- **AdminIdleGuard** (`components/admin/AdminIdleGuard.tsx`): 어드민 대시보드 레이아웃에 적용
- **감지 이벤트:** mousedown, mousemove, keydown, scroll, touchstart
- **기본 유휴 시간:** 30분. 환경변수 `NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN`으로 30~60분 등 조정 가능
- **동작:** 유휴 시간 경과 시 alert → signOut → `/admin/login?callbackUrl=/admin` 리다이렉트

### 4.3 401 전역 인터셉터

- **adminFetch** (`lib/admin-fetch.ts`): 어드민 전용 fetch 래퍼
- 모든 어드민 API 호출(page.tsx, components/admin)에서 `fetch` 대신 `adminFetch` 사용
- **401 수신 시:** 세션 만료 alert → signOut → 로그인 페이지 리다이렉트. 빈 화면("등록된 상품이 없습니다") 대신 명시적 로그아웃 처리

### 4.4 적용 범위

- `app/admin/(dashboard)/**` 페이지
- `components/admin/*` (ProductRegistrationModal, Call070Modal, ClientRegistrationModal, PartnerRegistrationForm 등)

---

## 변경 이력 (병합)

| 날짜 (KST) | 내용 |
|------------|------|
| 2026-02-10 | PARTNER_ADMIN_ACCESS_CHECKLIST, PARTNER_REGISTRATION_FIX_GUIDE, MOBILE_SHOP_LOGIN_FIX 병합 → ADMIN_GUIDE.md |
| 2026-02-10 | Part 4 추가: 어드민 보안 정책 (1시간 세션, 30분 유휴 자동 로그아웃, 401 전역 인터셉터) |
