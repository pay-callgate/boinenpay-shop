# 마스터 템플릿 동기화 점검 리포트

**점검 일자:** 2025-02-10  
**점검 범위:** 파트너 마스터 템플릿 및 전역 컴포넌트 (`app/[subdomain]/[clientSlug]/` 레이아웃, `components/shop/`)

---

## 1. 상태 관리 및 API 호출 (레거시 코드 제거)

### 점검 결과
- **쇼핑몰 마스터 템플릿** (`app/[subdomain]/[clientSlug]/layout.tsx`, `components/shop/ShopLayout.tsx`):  
  - partner/client는 **서버 레이아웃**에서 Supabase로 조회 후 `ShopGlobalLayout`에 props로 전달됨.  
  - 클라이언트에서 `/api/partner` 단독 fetch 하는 코드 없음. ✅  
- **전역 컴포넌트** (SmartHeader, SideMenu, GlobalBottomNav):  
  - 모두 `useShopTemplate()` Context에서 partner/client 사용. ✅  
- **참고:** `app/[subdomain]/admin/` 하위 페이지들은 **파트너 관리자(Admin)** 전용으로, subdomain 기준 partner 조회가 필요해 `/api/partner` 호출을 유지. 쇼핑몰 마스터 템플릿과는 별도 영역.

### 수정 사항
- 이번 점검에서 **추가로 제거한 레거시 fetch 없음**. (기존에 마이페이지·주문 등은 이미 Context 전환 완료)

---

## 2. 톤앤매너 동기화 (촌스러운 색상 교체)

### 적용 기준
- **메인 컬러:** `#D6A8E0` (파스텔 연보라)
- **배경:** `#fff` 또는 `#F5F5F5` / `#F3F4F6`
- **선택 배경(연한 톤):** `#F8F5FF` (카테고리 탭 등)

### 동기화(수정)한 파일

| 파일 경로 | 수정 내용 |
|-----------|-----------|
| `components/shop/ClientSearchModal.tsx` | `#8B5CF6` → `#D6A8E0` (버튼·체크 아이콘), 선택 행 배경 `#F3E8FF` → `#F8F5FF` |
| `components/shop/OrderGuard.tsx` | "소속 기업 찾기" 버튼 배경 `#8B5CF6` → `#D6A8E0` |
| `app/[subdomain]/[clientSlug]/mypage/orders/page.tsx` | 상태 색·쇼핑하러가기 버튼·하단 Nav 활성색 `#8B5CF6` → `#D6A8E0`, Nav 배경 `#F3E8FF` → `#fff` |
| `app/[subdomain]/[clientSlug]/mypage/orders/[id]/page.tsx` | 동일 톤앤매너 적용 (`#8B5CF6` → `#D6A8E0`, `#F3E8FF` → `#fff`) |
| `app/[subdomain]/[clientSlug]/products/page.tsx` | 카테고리 탭 선택색·더보기 버튼 `#8B5CF6` → `#D6A8E0`, 선택 배경 `#F3E8FF` → `#F8F5FF` |

### 이미 적용되어 있던 파일
- `components/shop/ShopLayout.tsx`: `PRIMARY = "#D6A8E0"`, 하단 Nav·헤더 뱃지 등 이미 연보라 사용. ✅  
- `app/[subdomain]/[clientSlug]/mypage/wishlist/page.tsx`, `addresses/page.tsx` 등: 이전 작업에서 이미 `#D6A8E0` 적용됨. ✅  

---

## 3. 반응형 레이아웃 (세로 화면 짤림 방지)

### 점검 결과
- 긴 세로 화면(S20 Ultra 등)에서 메인 콘텐츠 영역이 짧을 때, 하단에 회색 배경이 드러나던 구조 확인.

### 수정 사항 (동기화한 파일)

| 파일 경로 | 수정 내용 |
|-----------|-----------|
| `components/shop/ShopLayout.tsx` | **ShopLayout** (레거시): 최상위 래퍼에 `flex flex-col`, 내부 컨테이너에 `flex-1 flex flex-col`, `<main>`에 `flex-1 overflow-auto` 적용 |
| `components/shop/ShopLayout.tsx` | **ShopGlobalLayout**: 동일하게 최상위 `flex flex-col`, 내부 `flex-1 flex flex-col`, `<main className="flex-1 overflow-auto">` 적용 |

이제 메인 콘텐츠가 짧아도 흰색 영역이 남는 세로 공간을 채우며, 하단 회색 띠가 보이지 않습니다.

---

## 4. 요약

| 구분 | 점검 항목 | 결과 |
|------|-----------|------|
| 1 | 상태 관리·API 호출 (레거시 제거) | 쇼핑몰 템플릿·전역 컴포넌트는 Context 기반으로 유지, 추가 제거 없음 |
| 2 | 톤앤매너 (#8B5CF6·#F3E8FF 제거) | 전역 2개 + 거래처 라우트 3개 파일 색상 동기화 완료 |
| 3 | 반응형 레이아웃 (flex·flex:1) | ShopLayout·ShopGlobalLayout 2곳 수정 완료 |

**총 동기화(수정) 파일:** 6개  
- `components/shop/`: ClientSearchModal, OrderGuard, ShopLayout  
- `app/[subdomain]/[clientSlug]/`: mypage/orders/page.tsx, mypage/orders/[id]/page.tsx, products/page.tsx  

이제 신규 거래처가 생성되어도 동일한 마스터 템플릿과 톤앤매너·레이아웃이 일관되게 적용됩니다.
