# NextAuth·인증 오류 분석 및 수정 계획

**병합 문서:** NEXTAUTH_CLIENT_FETCH_ERROR_ANALYSIS  
**최종 수정:** 2026-02-10

---

## 1. 발생 오류

- **에러 코드:** `[next-auth][error][CLIENT_FETCH_ERROR] "Failed to fetch"`
- **의미:** NextAuth 클라이언트가 `/api/auth/session` 등 auth API를 호출했으나 네트워크 요청 자체가 실패한 상태.
- **참고:** https://next-auth.js.org/errors#client_fetch_error

---

## 2. 원인 분석

| 우선순위 | 원인 | 설명 |
|----------|------|------|
| 1 | 개발 서버 미동작/재시작 | `npm run dev` 꺼짐 또는 070 연동 등으로 서버 지연 시 fetch 실패/타임아웃 |
| 2 | Auth API 라우트 예외 | getServerSession/authOptions 내부 예외 → 500 → 클라이언트가 "Failed to fetch"로 표시 |
| 3 | NEXTAUTH_URL 불일치 | 브라우저가 https 또는 127.0.0.1로 접속 시 쿠키/요청 불일치 |
| 4 | Turbopack/Next.js 16 dev 이슈 | API 라우트 일시 불안정 또는 캐시 문제 |

확인 사항: middleware는 `api` 제외, NEXTAUTH_URL=http://localhost:3000, auth 라우트는 NextAuth(authOptions) export.

---

## 3. 수정 계획

### 3.1 즉시 확인

1. 개발 서버 실행 여부, 터미널 에러 로그
2. 접속 URL이 `http://localhost:3000` 인지
3. 페이지 새로고침 또는 서버 재시작 후 재시도

### 3.2 재현 시

- 브라우저에서 `http://localhost:3000/api/auth/session` 직접 호출 → JSON vs 500 확인, 터미널 스택 확인.

### 3.3 코드/설정 보완 (선택)

- A. Auth API 예외 처리: auth 라우트 또는 lib/auth.ts에서 예외 catch·로깅
- B. 세션 API 헬스 체크로 500 원인 확인
- C. Turbopack 비활성화 후 재현 여부 확인

---

## 4. 어드민 보안 정책 (2026-02-10 도입)

| 항목 | 내용 |
|------|------|
| **세션 maxAge** | 1시간 (3,600초). lib/auth.ts |
| **유휴 자동 로그아웃** | 30분 기본. AdminIdleGuard. NEXT_PUBLIC_ADMIN_IDLE_TIMEOUT_MIN으로 조정 |
| **401 인터셉터** | adminFetch. 모든 어드민 API 호출에 적용. 401 시 alert → signOut → /admin/login |

---

## 5. 요약

- CLIENT_FETCH_ERROR = auth API 호출 실패. DB/070과 무관.
- 어드민: 1시간 세션, 30분 유휴 로그아웃, 401 시 adminFetch가 즉시 로그인 페이지로 이동.
- 서버 동작·접속 URL 확인 후 `/api/auth/session` 직접 호출로 원인 축소.
