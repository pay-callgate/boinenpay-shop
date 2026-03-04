# 주문 업데이트 실패 원인 분석 및 수정 계획

**발생 시점:** 2026-03-03, 주문 상세에서 상태를 "배송준비중"으로 변경 시도 시  
**에러 메시지:** `주문 업데이트 실패` (PATCH 500)  
**DB 에러:** `new row for relation "orders" violates check constraint "orders_status_check"`

---

## 1. 원인 분석

### 1.1 터미널 로그 요약

- **에러 코드:** `23514` (PostgreSQL CHECK constraint violation)
- **제약 조건:** `orders_status_check`
- **실패 행의 status 값:** `preparing`
- **의미:** `orders.status`에 `'preparing'`을 넣었지만, DB가 허용하는 값 목록에 없어서 거부된 상태입니다.

### 1.2 DB에서 허용하는 주문 상태

마이그레이션 기준으로 `orders.status`는 아래만 허용됩니다.

| 파일 | 허용 값 |
|------|--------|
| `supabase/migrations/20260210_init_schema.sql` (CHECK) | `'received', 'confirmed', 'shipping', 'delivered', 'confirmed_purchase', 'cancelled', 'returned'` |
| `supabase/migrations/20260210000001_enums_and_core_tables.sql.txt` (ENUM) | 동일 7개 (preparing 없음) |

→ **`'preparing'`은 두 스키마 모두에 정의되어 있지 않습니다.**

### 1.3 애플리케이션에서 사용하는 값

- **파트너 어드민 주문 상세/배송관리:** "배송준비중" 옵션의 **value = `preparing`**  
  - `app/admin/(dashboard)/orders/[id]/page.tsx`  
  - `app/admin/(dashboard)/orders/shipping/page.tsx`
- **PATCH API:** 요청 body의 `status`를 그대로 `orders` 테이블에 전달  
  - `app/api/partner/orders/[id]/route.ts`  
  - 별도 매핑 없이 `update({ status })` 수행

그래서 사용자가 "배송준비중"을 선택하면 `preparing`이 그대로 DB에 들어가고, `orders_status_check` 위반으로 500이 발생합니다.

### 1.4 결론

| 구분 | 내용 |
|------|------|
| **직접 원인** | DB의 `orders_status_check`(또는 `order_status` ENUM)에 `'preparing'`이 없음 |
| **유발 경로** | UI "배송준비중" → API에 `status: 'preparing'` 전달 → DB update 시 제약 위반 |
| **영향** | 파트너 어드민에서 "배송준비중"으로 상태 변경 시 항상 500, "주문 업데이트 실패" 표시 |

---

## 2. 수정 계획 (선택)

### 방안 A: DB에 `preparing` 추가 (권장)

- **의미:** "배송준비중"을 주문 상태로 공식 추가해, UI·API·DB가 모두 `preparing`으로 일치하게 함.
- **작업 내용:**
  1. **마이그레이션 추가**
     - 현재 적용 중인 스키마가 **CHECK 제약**이면:  
       `orders_status_check`를 삭제 후 `'preparing'`을 포함한 새 CHECK로 재정의.
     - **ENUM**이면:  
       `ALTER TYPE order_status ADD VALUE 'preparing';`
     - `order_status_history` 등 동일 제약/ENUM을 쓰는 컬럼이 있으면 같이 수정.
  2. **애플리케이션 코드:** 변경 없음. (이미 `preparing` 사용 중)
- **장점:** 상태 의미가 명확하고, 이후 "배송준비중" 전용 로직/통계 추가가 쉬움.  
- **단점:** DB 마이그레이션 실행 필요.

### 방안 B: API에서만 매핑 (DB 스키마 미변경)

- **의미:** DB는 기존 7개 값만 쓰고, "배송준비중"은 그중 하나로 매핑해 저장.
- **작업 내용:**
  1. **PATCH `/api/partner/orders/[id]`**  
     - 요청의 `status === 'preparing'`일 때만, DB에는 `'confirmed'`(또는 정한 하나의 값)로 저장.
     - 응답/이력에는 프론트가 쓰는 값(`preparing`)을 그대로 반환할지, 아니면 `confirmed`로 통일할지 정책 결정 필요.
  2. **프론트:**  
     - "배송준비중" → `preparing` 유지해도 됨. (API가 내부적으로만 매핑)
  3. **DB:** 마이그레이션 없음.
- **장점:** DB를 건드리지 않아도 됨.  
- **단점:** DB에는 "배송준비중"과 "주문확인"이 같은 값(`confirmed`)으로만 저장되어 구분이 안 됨.

---

## 3. 권장안 및 다음 단계

- **권장:** **방안 A (DB에 `preparing` 추가)**  
  - 비즈니스상 "배송준비중"을 별도 상태로 두는 것이 자연스럽고,  
  - 이미 UI/API는 `preparing`을 쓰고 있으므로, DB만 맞추면 됨.

---

## 4. 적용 내역 (방안 A)

- **마이그레이션 파일:** `supabase/migrations/20260303000001_add_order_status_preparing.sql`
- **내용:** `orders_status_check` 제약을 삭제 후 `'preparing'`을 포함한 8개 값으로 재정의.
- **적용 방법:**
  - Supabase CLI 사용 시: `npx supabase db push` 또는 `npx supabase migration up`
  - Supabase 대시보드 사용 시: SQL Editor에서 해당 마이그레이션 파일 내용을 복사해 실행.
