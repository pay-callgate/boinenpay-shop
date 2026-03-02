# 거래처 쇼핑몰 주문 전용 URL — 마스터 템플릿 전수 동기화 점검 보고서

**점검 일자:** 2025-02-10  
**목적:** 거래처 쇼핑몰 주문 전용 URL(예: 기아자동차 `/{subdomain}/{clientSlug}`)의 모든 페이지가 마스터 템플릿과 **100% 동일**하게 적용되었는지 전수 검수. 신규 거래처 등록·전체 기능 테스트에 대비.

---

## 1. 점검 범위

| 구분 | 경로 | 비고 |
|------|------|------|
| **레이아웃** | `app/[subdomain]/[clientSlug]/layout.tsx` | 단일 레이아웃 → `ShopGlobalLayout`만 사용 |
| **페이지** | `app/[subdomain]/[clientSlug]/**/*.tsx` | 메인, 카트, 결제, 상품, 마이페이지 등 전 페이지 |
| **공통 컴포넌트** | `components/shop/*.tsx` | ShopLayout, SideMenu, OrderGuard, ProductSearchModal, ClientSearchModal 등 |

---

## 2. 레이아웃 및 템플릿 일관성

### 2.1 단일 레이아웃 사용

- **`[subdomain]/[clientSlug]/layout.tsx`**  
  - 서버에서 `partners` / `clients` Supabase 조회 후 **항상** `ShopGlobalLayout`에 `partner`, `client`를 props로 전달.
  - 거래처별로 다른 레이아웃을 쓰는 분기 없음. ✅

### 2.2 ShopGlobalLayout 구성 (마스터 템플릿)

- **SmartHeader** (상단 고정)
- **SideMenu** (partner 존재 시에만 렌더, `onSearchClick`으로 검색 모달 연동)
- **ProductSearchModal** (헤더·사이드메뉴 검색 버튼 공통)
- **main** (paddingTop: HEADER_HEIGHT, paddingBottom: BOTTOM_NAV_HEIGHT, flex-1 overflow-auto)
- **ShopBottomNav** (하단 고정)

모든 `[clientSlug]` 하위 페이지는 동일한 위 구조 안에서 렌더됨. ✅

### 2.3 파트너 루트(`/[subdomain]`)와의 관계

- `/[subdomain]` 단독 페이지는 **마스터 템플릿 미리보기**용으로 `ShopLayout` 사용 (client 없음, orderAllowed: false).
- 거래처 주문 전용 URL은 **오직** `/[subdomain]/[clientSlug]` 이며, 여기만 본 점검 대상. ✅

---

## 3. 페이지별 점검 결과

### 3.1 페이지 목록 및 OrderGuard 적용

| 페이지 | 경로 | OrderGuard | 비고 |
|--------|------|------------|------|
| 메인 | `page.tsx` | 불필요 | 비로그인도 메인 조회 가능 |
| 카테고리/상품 목록 | `products/page.tsx` | ✅ | partnerId/client 매칭 후 진입 |
| 상품 상세 | `products/[slug]/page.tsx` | ✅ | 동일 |
| 장바구니 | `cart/page.tsx` | ✅ | 동일 |
| 주문/결제 | `checkout/page.tsx` | ✅ | 동일 |
| 주문서 리다이렉트 | `order/page.tsx` | 불필요 | `/checkout`으로 즉시 리다이렉트 |
| 최근 본 상품 | `recent/page.tsx` | ✅ | 동일 |
| 마이페이지 | `mypage/page.tsx` | ✅ | 동일 |
| 주문 목록 | `mypage/orders/page.tsx` | ✅ | 동일 |
| 주문 상세 | `mypage/orders/[id]/page.tsx` | ✅ | 동일 |
| 프로필 | `mypage/profile/page.tsx` | ✅ | 동일 |
| 배송지 목록 | `mypage/addresses/page.tsx` | ✅ | 동일 |
| 배송지 등록 | `mypage/addresses/new/page.tsx` | ✅ | 동일 |
| 배송지 수정 | `mypage/addresses/[id]/page.tsx` | ✅ | 동일 |
| 위시리스트 | `mypage/wishlist/page.tsx` | ✅ | 동일 |

**결과:** 주문/결제·마이페이지·장바구니 등 필요한 모든 페이지에 OrderGuard 적용됨. ✅

### 3.2 톤앤매너(PRIMARY #D6A8E0) 동기화

**기준:** 메인 컬러 `#D6A8E0`, 선택 배경 등 연한 톤 `#F8F5FF` (또는 `#F3E8F5` 결제 등).

- **이미 적용된 페이지**  
  cart, checkout, products, products/[slug], recent, mypage, mypage/orders, mypage/orders/[id], mypage/profile, mypage/addresses, mypage/addresses/new, mypage/addresses/[id], mypage/wishlist — 모두 `#D6A8E0` 또는 `PRIMARY` 상수 사용 확인. ✅

- **이번 전수 검수에서 추가 수정한 파일**

| 파일 | 수정 내용 |
|------|-----------|
| `app/[subdomain]/[clientSlug]/page.tsx` | 에러 시 "홈으로 이동" 버튼 `bg-purple-500` → `#D6A8E0`; 로딩 스피너 `border-t-purple-500` → `#D6A8E0` |
| `app/[subdomain]/[clientSlug]/products/page.tsx` | "홈으로" 버튼 `bg-purple-500` → `PRIMARY` |
| `app/[subdomain]/[clientSlug]/products/[slug]/page.tsx` | 배송 태그 `bg-purple-50 text-purple-700` → `#F8F5FF` + PRIMARY; 옵션 select `focus:ring-purple-200` → `focus:ring-[#D6A8E0]/40`; 탭 활성 `text-purple-700 border-purple-700` → PRIMARY |
| `app/[subdomain]/page.tsx` | "홈으로 이동" 버튼 `bg-purple-500` → `#D6A8E0` (마스터 템플릿 미리보기와 톤 통일) |

**점검 후:** `app/[subdomain]/[clientSlug]/**` 및 `components/shop/**` 내 `purple`, `#8B5CF6`, `#F3E8FF` 검색 결과 **0건**. ✅

---

## 4. 공통 컴포넌트

| 컴포넌트 | 역할 | 동기화 상태 |
|----------|------|-------------|
| `ShopLayout.tsx` | PRIMARY #D6A8E0, HEADER_HEIGHT, BOTTOM_NAV_HEIGHT, ShopLayout/ShopGlobalLayout | ✅ |
| `SideMenu.tsx` | onSearchClick → 검색 모달 연동 | ✅ |
| `ProductSearchModal.tsx` | 검색 모달 (프리미엄 UI) | ✅ |
| `OrderGuard.tsx` | 주문 가능 전제(로그인·거래처 매칭) | ✅ (버튼 #D6A8E0) |
| `ClientSearchModal.tsx` | 소속 기업 찾기 (OrderGuard 내) | ✅ (기존 동기화 완료) |

---

## 5. 요약 및 결론

| 구분 | 점검 항목 | 결과 |
|------|-----------|------|
| 1 | 단일 레이아웃(ShopGlobalLayout) | 모든 거래처 쇼핑몰 페이지 동일 적용 ✅ |
| 2 | OrderGuard 적용 | 주문/결제·마이페이지·장바구니·상품 등 필요 페이지 전부 적용 ✅ |
| 3 | 톤앤매너(PRIMARY #D6A8E0) | 구 purple 계열 제거, 4개 파일 추가 수정 후 전 페이지 동일 ✅ |
| 4 | 공통 컴포넌트 | ShopLayout, SideMenu, ProductSearchModal, OrderGuard, ClientSearchModal 일관 적용 ✅ |

**이번 전수 검수에서 수정한 파일:** 4개  
- `app/[subdomain]/[clientSlug]/page.tsx`  
- `app/[subdomain]/[clientSlug]/products/page.tsx`  
- `app/[subdomain]/[clientSlug]/products/[slug]/page.tsx`  
- `app/[subdomain]/page.tsx`  

**결론:** 거래처 쇼핑몰 주문 전용 URL(`/{subdomain}/{clientSlug}`)의 모든 페이지는 마스터 템플릿과 **100% 동일한** 레이아웃·OrderGuard·톤앤매너로 동기화되었습니다. 신규 거래처 등록 후 전체 기능 테스트 시 동일한 UX가 적용됩니다.
