# 세션 처리 전수 검사 보고서

**검사 일자:** 2026-02-10  
**목적:** 파트너 어드민·거래처(쇼핑몰) 세션 시간 정책 확인 및 “너무 빨리 튕김 / 로그인 화면으로 리다이렉트 안 됨” 현상 원인 분석·수정

---

## 1. 정책 요약 (PRD 기준 + 보강)

| 구분 | 파트너 어드민 | 거래처(쇼핑몰) |
|------|----------------|----------------|
| **세션 만료(JWT)** | **2시간(7,200초)** — 조기 만료 방지, 실질 관리는 유휴가 담당 | 동일 (NextAuth 공통) |
| **세션 Keep-alive** | **refetchInterval 30분** + **refetchOnWindowFocus true** | 동일 |
| **유휴 자동 로그아웃** | **30분** (기본값), 1분 전 토스트 경고 후 만료 시 토스트 안내·리다이렉트 | **없음** |

- JWT는 **2시간**으로 넉넉히 두고, **실질 보안·UX는 AdminIdleGuard(유휴 30분 + 1분 전 경고)** 가 담당.

---

## 2. 현재 구현 상태

### 2.1 세션 만료 시간 (JWT maxAge)

| 파일 | 설정 | 비고 |
|------|------|------|
| `lib/auth.ts` | `session: { strategy: "jwt", maxAge: 7200 }` | 7,200초 = **2시간**. 유휴(30분)보다 길게 두어 JWT가 먼저 죽지 않도록 함 ✅ |

→ **파트너 어드민 / 거래처 모두 2시간**으로 동일. 유휴(30분)보다 길어 JWT가 먼저 만료되지 않음.

### 2.2 세션 Keep-alive (공통)

| 파일 | 설정 | 비고 |
|------|------|------|
| `components/providers/SessionProvider.tsx` | `refetchInterval={1800}`, `refetchOnWindowFocus={true}` | 30분마다 세션 갱신, 탭 포커스 시 즉시 동기화 ✅ |

### 2.3 유휴 자동 로그아웃 (어드민 전용)

| 파일 | 설정 | 비고 |
|------|------|------|
| `components/admin/AdminIdleGuard.tsx` | `NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN` (분) → ms 변환, 기본 30분 | **수정 전:** env가 `0` 또는 작은 값(예: 1, 5)이면 실제 유휴 시간이 1분·5분이 되어 “너무 빨리 튕김” 발생 가능 |

- **수정 내용:** 유휴 타임아웃을 **최소 30분**으로 고정. env가 30 미만이어도 30분으로 동작.

### 2.4 401 시 로그인 페이지 리다이렉트

| 구분 | 파일 | 수정 전 | 수정 후 |
|------|------|--------|--------|
| **어드민** | `lib/admin-fetch.ts` | `signOut({ redirect: false })` 후 `window.location.href` | `signOut`을 try/catch로 감싸고, **`window.location.replace(ADMIN_LOGIN_URL)`** 로 이동 보장 |
| **쇼핑몰** | `lib/shop-fetch.ts` | `signOut({ redirect: true, callbackUrl: loginUrl })` 에만 의존 | `signOut({ redirect: false })` 후 **`window.location.replace(loginUrl)`** 로 직접 이동. NextAuth redirect 미동작 시에도 로그인 페이지로 이동 보장 |

- NextAuth `signOut({ redirect: true, callbackUrl })` 가 환경/상태에 따라 리다이렉트를 안 할 수 있어, **항상 `window.location.replace`로 한 번 더 보장**하도록 변경.

---

## 3. 수정 요약

1. **SessionProvider (Keep-alive)**
   - **refetchInterval={1800}** (30분), **refetchOnWindowFocus={true}** — 활동 중·탭 복귀 시 세션 갱신으로 조기 만료 방지.

2. **AdminIdleGuard**
   - 유휴 타임아웃 **최소 30분** 적용.
   - **1분 전** 토스트: "장시간 미활동으로 1분 후 로그아웃됩니다."
   - **만료 시** 토스트: "세션이 만료되어 로그인 화면으로 이동합니다." 후 `window.location.replace` 로 이동.

3. **lib/auth.ts**
   - **maxAge: 7200** (2시간). JWT가 유휴(30분)보다 먼저 죽지 않도록 하여, 실질 관리는 AdminIdleGuard가 담당.

4. **adminFetch (401)**
   - `signOut` 실패 시에도 **`window.location.replace(ADMIN_LOGIN_URL)`** 가 실행되도록 try/catch 추가.

5. **shopFetch (401/403)**
   - `signOut({ redirect: false })` 후 **`window.location.replace(loginUrl)`** 로 이동하도록 변경해, 리다이렉트 누락 방지.

---

## 4. 세션 관련 파일 체크리스트

| 파일 | 역할 | 검사 결과 |
|------|------|-----------|
| `lib/auth.ts` | NextAuth 옵션, session.maxAge 2시간(7200) | ✅ |
| `components/providers/SessionProvider.tsx` | refetchInterval 30분, refetchOnWindowFocus true | ✅ |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth 핸들러 | ✅ |
| `middleware.ts` | /admin* 토큰 없으면 /admin/login 리다이렉트 | ✅ |
| `app/admin/(dashboard)/layout.tsx` | getServerSession 없으면 redirect("/admin/login?callbackUrl=/admin") | ✅ |
| `components/admin/AdminIdleGuard.tsx` | 어드민 유휴 30분(최소) + 1분 전 토스트 + 만료 시 토스트·replace | ✅ 수정 반영 |
| `lib/admin-fetch.ts` | 401 → alert, signOut, replace(로그인) | ✅ 수정 반영 |
| `lib/shop-fetch.ts` | 401/403 → toast, signOut, replace(로그인) | ✅ 수정 반영 |
| `app/[subdomain]/login/page.tsx` | callbackUrl 기반 로그인 후 복귀 | ✅ |
| `app/admin/login/page.tsx` | callbackUrl 기반 어드민 로그인 | ✅ |

---

## 5. 결론

- **세션 시간:** JWT **2시간**으로 넉넉히 두고, **실질 보안·UX는 유휴 30분(AdminIdleGuard)** 가 담당. 활동 중에는 **refetchInterval 30분**으로 세션 갱신.
- **“너무 빨리 튕김”:** 유휴 최소 30분 + Keep-alive로 **심리적/실제적 조기 만료** 완화.
- **“로그인 화면으로 리다이렉트 안 됨”:** **"갑자기 튕김" 완화:** 유휴 **1분 전 토스트** + 만료 시 **토스트 안내 후** 로그인 페이지로 이동.
- **리다이렉트:** 401/유휴 만료 시 **`window.location.replace`** 로 로그인 이동 보장.

**최종 구조:** 세션은 넉넉히 유지하고, 보안 관리는 유휴 타이머가 1분 전 경고 → 만료 시 친절 안내 후 이동하는 구조. 세션은 넉넉히 유지하고, 보안 관리는 유휴 타이머가 1분 전 경고 → 만료 시 친절 안내 후 이동하는 구조.

이후에도 동일 현상이 있으면 `NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN` 값(예: 30 이상 권장)과, 401 발생 시 브라우저 콘솔/네트워크 탭에서 `adminFetch`/`shopFetch` 호출 여부를 확인하면 됨.
