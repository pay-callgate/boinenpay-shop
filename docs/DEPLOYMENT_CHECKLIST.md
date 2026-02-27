# 배포 체크리스트

**목적:** 프로덕션/스테이징 배포 시 거래처별 모바일 쇼핑몰 URL·환경 변수·hydration 대응을 한곳에서 점검.

---

## 1. 거래처 쇼핑몰 URL 전체 플로우 (배포 시 문제 없도록)

| 구간 | 동작 | 배포 시 고려 |
|------|------|--------------|
| **진입** | 프로덕션: `{subdomain}.shopping.com/{clientSlug}` → Middleware가 `/{subdomain}/{clientSlug}` 로 Rewrite | `lib/tenant.ts` getSubdomainFromRequest 기준. 도메인이 `*.shopping.com` 이어야 함. |
| **로컬** | `localhost:3000/{subdomain}/{clientSlug}` (경로 첫 세그먼트가 subdomain) | Middleware는 `/` 만 `/testpartner/` 로 리다이렉트. |
| **링크 생성** | 어드민 링크 관리·복사·070 서비스 URL | `lib/app-url.ts` getBaseUrl / getStorefrontUrl 사용. **window 미사용** → hydration·배포 동일. |
| **로그인 콜백** | 쇼핑몰 로그인 후 돌아갈 URL | 기본값을 getStorefrontUrl(subdomain)으로 고정. |
| **070 연동** | CallCloud 등록용 서비스 URL | API에서 NEXT_PUBLIC_APP_URL → VERCEL_URL → request origin 순 fallback. |

---

## 2. Base URL (환경 변수 우선순위)

**사용처:** `lib/app-url.ts` — `getBaseUrl()`, `getStorefrontUrl(subdomain, clientSlug?)`

| 우선순위 | 변수 | 설명 |
|----------|------|------|
| 1 | `NEXT_PUBLIC_APP_URL` | **배포 시 설정 권장.** 프로덕션 도메인 (예: `https://shopping.example.com`). 끝 `/` 제거. |
| 2 | `VERCEL_URL` | Vercel 배포 시 자동. 미설정이면 `https://${VERCEL_URL}` 사용. |
| 3 | (없음) | 로컬 fallback: `http://localhost:3000` |

- **프로덕션:** `NEXT_PUBLIC_APP_URL` 설정 시 복사·표시·070 서비스 URL이 모두 해당 도메인으로 동작.
- **Vercel 프리뷰:** 설정 없어도 `VERCEL_URL`로 배포 URL 사용 가능.

---

## 3. Middleware (프로덕션 subdomain → path Rewrite)

- **파일:** `middleware.ts`
- **동작:** `yenmidang.shopping.com/samsungelec` 접속 시 `getSubdomainFromRequest(host, pathname)` 로 subdomain 추출 후 `/{subdomain}{pathname}` 으로 **Rewrite**.
- **도메인 조건:** `lib/tenant.ts` 에서 `host.endsWith("shopping.com")` 기준. 커스텀 도메인 사용 시 tenant 도메인 상수 확인.

---

## 4. URL 사용처 정리 (window 제거·배포 대응 완료)

| 파일 | 용도 |
|------|------|
| `lib/app-url.ts` | getBaseUrl, getStorefrontUrl (단일 소스) |
| `app/[subdomain]/admin/(dashboard)/clients/links/page.tsx` | 링크 표시·복사·070 모달 serviceUrl |
| `app/[subdomain]/admin/(dashboard)/clients/page.tsx` | 거래처 목록 복사·070 모달 serviceUrl |
| `app/[subdomain]/login/page.tsx` | 로그인 후 callbackUrl 기본값 |
| `app/api/clients/[id]/070/register/route.ts` | CallCloud serviceUrl (서버 origin fallback) |

---

## 5. 기타 배포 시 필수/권장 환경 변수

- `NEXTAUTH_URL`: 배포 도메인 URL (예: `https://shopping.example.com`)
- `NEXTAUTH_SECRET`: 프로덕션용 시크릿
- Supabase / OAuth: 프로덕션 값 설정

---

## 6. 참고

- Hydration 오류 방지: 서버에는 `window` 없음 → `href`/텍스트가 서버·클라이언트에서 달라지면 오류. 모든 “거래처 쇼핑몰용 절대 URL”은 `lib/app-url.ts` 로만 생성.
- 프로덕션에서 서브도메인 접속 시 404가 나면: Middleware matcher·tenant 도메인 조건·호스팅의 서브도메인 라우팅 설정을 확인.
