# 잔존 alert 제거 및 검색 UI 고도화 — 진행 리포트

**작업 일자:** 2025-02-10  
**목적:** `window.alert()` 전수 제거 → 토스트로 교체, 검색 모달 UI 고도화

---

## 1. 진행 상황 요약

| 구분 | 상태 | 비고 |
|------|------|------|
| **검색 UI 리팩토링** | ✅ 완료 | 이전 작업에서 적용됨 |
| **alert 전수 조사** | ✅ 완료 | 아래 목록 정리 |
| **토스트 교체 (쇼핑몰)** | ✅ 완료 | shop-fetch, ToastContext, daum-postcode (유지) |
| **어드민 alert 롤백** | ✅ 완료 | 업무용 확실성 위해 어드민만 alert/confirm으로 복구 (2026-02-10) |

---

## 2. 검색 UI 리팩토링 (이미 완료)

`ProductSearchModal.tsx`는 이전 작업에서 아래와 같이 적용됨:

- **backdrop-blur-md** — 오버레이 유리 질감 ✅
- **인기 검색어 태그** — `rounded-full bg-gray-100` 3~4개 ✅
- **검색창** — 테두리 제거, `bg-gray-50` ✅
- **풀와이드 상단 밀착** — `rounded-b-2xl` ✅

---

## 3. alert 전수 조사 결과

### 3.1 거래처 쇼핑몰 (사용자 노출)

| 파일 | 라인 | 메시지 | 비고 |
|------|------|--------|------|
| `lib/shop-fetch.ts` | 16 | "안전한 이용을 위해 세션이 만료되었습니다. 다시 로그인해 주세요." | **401/403 시** — 사용자 화면에 노출 |
| `components/shop/ToastContext.tsx` | 40 | (fallback) | globalToast 미설정 시 `window.alert` 호출 |

### 3.2 어드민

| 파일 | 라인 | 메시지 |
|------|------|--------|
| `lib/admin-fetch.ts` | 23 | "세션이 만료되었습니다. 안전한 이용을 위해 다시 로그인해 주세요." |
| `components/admin/AdminIdleGuard.tsx` | 18 | "장시간 사용자 활동이 없어 세션이 종료됩니다. 다시 로그인해 주세요." |
| `app/admin/(dashboard)/products/[id]/edit/page.tsx` | 136, 172 | 이미지 업로드 실패, 저장 실패 |
| `app/admin/(dashboard)/products/new/page.tsx` | 86, 123 | 이미지 업로드 실패, 저장 실패 |
| `app/admin/(dashboard)/products/page.tsx` | 122 | 삭제 실패 |
| `app/admin/(dashboard)/products/inventory/page.tsx` | 102 | 저장 실패 |
| `app/admin/(dashboard)/clients/page.tsx` | 137, 143 | 삭제 실패, 링크 복사 성공 |
| `app/admin/(dashboard)/clients/links/page.tsx` | 145, 162 | 복사 실패, 삭제 실패 |
| `app/admin/(dashboard)/categories/page.tsx` | 122, 134 | 저장 실패, 삭제 실패 |
| `app/admin/(dashboard)/orders/page.tsx` | 152, 156 | 엑셀 다운로드 실패 |
| `app/admin/(dashboard)/orders/[id]/page.tsx` | 185, 189, 192 | 상태 업데이트 성공/실패, 네트워크 오류 |
| `app/admin/(dashboard)/orders/shipping/page.tsx` | 154, 157 | 저장 실패, 네트워크 오류 |
| `components/admin/ProductRegistrationModal.tsx` | 210 | 상품 등록/수정 실패 |
| `components/admin/ClientRegistrationModal.tsx` | 155, 157, 212 | 로고 업로드 실패, 거래처 등록/수정 실패 |
| `components/admin/Call070Modal.tsx` | 82, 107, 112, 119, 152, 155, 161, 167 | 070 번호 관련 알림 |

### 3.3 기타

| 파일 | 비고 |
|------|------|
| `lib/daum-postcode.ts` | onError 미제공 시 `alert` fallback — 외부 라이브러리 패턴 |

---

## 4. 수정 완료 내역

### 4.1 쇼핑몰 (거래처 주문 전용 URL)

| 파일 | 수정 내용 |
|------|-----------|
| `lib/shop-fetch.ts` | 세션 만료 `alert` → `toast(..., "error")` |
| `components/shop/ToastContext.tsx` | `window.alert` fallback 제거 (no-op) |
| `lib/daum-postcode.ts` | onError 미제공 시 `alert` → `toast(..., "error")` |

### 4.2 어드민 (롤백 — alert 유지)

**2026-02-10 롤백:** 업무용 시스템은 토스트보다 사용자가 직접 확인을 눌러야 하는 `alert`/`confirm`이 더 안전하다는 판단으로 어드민 전역을 alert로 복구.

| 구분 | 상태 |
|------|------|
| `lib/admin-fetch.ts` | 세션 만료 시 `alert` 사용 |
| `components/admin/AdminIdleGuard.tsx` | 유휴 로그아웃 시 `alert` 사용 |
| `app/admin/(dashboard)/**`, `components/admin/*` | 저장/삭제/복사 등 실패·성공 → `alert` |
| ToastProvider | 어드민 레이아웃에서 제거 |

**결과:** 쇼핑몰은 토스트 유지, 어드민은 alert/confirm 유지

---

## 5. 어드민 세션·fetch 관련 (2026-02-10)

| 항목 | 내용 |
|------|------|
| **직접 fetch → adminFetch** | `orders/shipping` fetch("/api/partner"), `products/new`, `products/[id]/edit`, `ProductRegistrationModal` upload → 모두 adminFetch로 통일 |
| **adminFetch** | cache: "no-store", 401 시 signOut + window.location.href 강제 리다이렉트 |
| **Middleware** | getToken으로 /admin/* (login 제외) 토큰 검사, 없으면 즉시 로그인 리다이렉트 |
