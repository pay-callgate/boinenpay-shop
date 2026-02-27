# Development Guidelines for AI Agent

## 1. Global Decision Rules

### 1.1 Source of Truth Priority

- **Always** read and follow these documents, in this order, when behavior is unclear:
  - 1️⃣ `docs/PRD.md` (기능·역할·URL 정책)
  - 2️⃣ `docs/ERD.md` + `supabase/migrations/*.sql` (DB 스키마)
  - 3️⃣ `docs/DEVELOPMENT_PLAN.md` (모듈/Phase·Task 순서)
  - 4️⃣ `docs/API_SPEC.md` (엔드포인트·페이로드)
  - 5️⃣ `docs/PAGE_STRUCTURE_FLOW.md` (라우팅·페이지 구조)
  - 6️⃣ `rules/PROJECT_RULES.md` (인증·Multi-Tenancy 일반 규칙)
- **Do NOT** invent behavior that is not documented in the above files.
- **Do NOT** change spec-level behavior (역할 정의, URL 전략, 주문 플로우) without explicitly updating the corresponding docs first.

### 1.2 Module and Phase Order

- **Follow** the module order defined in `docs/DEVELOPMENT_PLAN.md` §2:
  - `M0 → M1 → (M2, M3) → M3.5 → M4 → (M5, M6)`.
- **Implement** tasks in each Phase roughly in the order listed in the **체크리스트** section of `DEVELOPMENT_PLAN.md`.
- **Do NOT** start:
  - `M1` before basic infra (`M0`) is in place.
  - `M4` before `M2`, `M3`, and `M3.5` are all functionally complete.
  - `M5` and `M6` before core 쇼핑몰 기능(`M4`)이 동작하는 상태.

### 1.3 Scope and Roles

- **Enforce** the role model:
  - `users.role ∈ {'partner_admin','client_staff','end_customer'}` only.
  - New SNS users **start** as `end_customer`.
  - When `user_clients` mapping is created or approved, **update** `users.role` to `client_staff`.
  - **Do NOT** reintroduce `CLIENT_ADMIN` or any other extra roles in DB or code.
- **Treat** 거래처 직원과 end_customer as the **same user entity**, differentiated only by `user_clients` mapping.
- **Respect** 1:1 rule: one `user_id` must belong to at most one `client_id`.

---

## 2. File and Directory Responsibility

### 2.1 Core Directories

- **`docs/`**:
  - Use for requirements and architecture, **never** for runtime logic.
  - When changing behavior (flows, roles, URL rules, DB shape), **update** the relevant doc(s) and their 변경 이력.
- **`supabase/migrations/`**:
  - Use for schema changes only (DDL).
  - **Never** modify these manually once run in production; create a new migration instead.
- **`supabase/seed/`**:
  - Use for non-production **test/seed data** (e.g. `seed/test_data.sql`).
  - **Do NOT** put secrets or environment-specific config here.
- **`rules/`**:
  - Treat as human-facing project rules. Mirror critical changes into `shrimp-rules.md` when they affect AI decisions.

### 2.2 Multi-file Coordination

- When modifying **DB schema** of any entity in `docs/ERD.md`:
  - **Also update**:
    - `supabase/migrations/*.sql` (or add new migration).
    - Any affected API definitions in `docs/API_SPEC.md`.
    - Any business logic assumptions in `docs/PRD.md` and `docs/DEVELOPMENT_PLAN.md` (if Phase/Task impact exists).
- When changing **URL or routing rules**:
  - **Also update**:
    - `docs/PRD.md` §4 (URL 전략) and 관련 표.
    - `docs/PAGE_STRUCTURE_FLOW.md`.
    - 관련 미들웨어/라우터 파일 (생성 후).
- When changing **roles or onboarding behavior**:
  - **Also update**:
    - `docs/PRD.md` §1.3, §2.1.
    - `docs/ERD.md` (users, user_clients).
    - `docs/DEVELOPMENT_PLAN.md` (M3.5, 가드 관련 Task).

---

## 3. Multi-Tenancy and Security Rules

### 3.1 Tenant Isolation

- **Always** filter tenant-scoped data by:
  - `partner_id` for partner-owned data (`partners`, `products`, `product_categories`, `banners`, `notices`, etc.).
  - `client_id` for client-scoped data (`orders`, `carts`, `wishlist_items`, `product_views`, etc.).
- **Do NOT**:
  - Query tables without appropriate `partner_id`/`client_id` constraints in API handlers.
  - Expose data from other tenants based on user input alone; always cross-check with authenticated context.

### 3.2 Client Session

- **Store** effective `client_id` in session/cookie when entering `/{sub}/{clientSlug}` (as per `DEVELOPMENT_PLAN` T4-2).
- **Use** this `client_id` consistently for:
  - Cart operations (`carts`, `cart_items`).
  - Order creation (`orders.client_id`).
  - Product tracking (`product_views`, `wishlist_items`).
- **Reject or guard** operations that lack a valid, tenant-consistent `client_id`.

### 3.3 Role-based Access

- **Partner admin**:
  - Allow access only to `/{subdomain}/admin/*` for `users.role == 'partner_admin'` and matching partner.
- **Client staff (구매자)**:
  - Allow 주문/결제 only when `users.role == 'client_staff'` and valid `user_clients` mapping exists.
- **End customer (소속 미확인)**:
  - Allow 브라우징; **block** 주문/결제.
  - **Trigger** 소속 매칭 플로우 (M3.5) when attempting to order.

---

## 4. Data Model Handling Rules

### 4.1 Users and User-Clients

- When **creating** a new SNS user:
  - Insert into `public.users` with `role = 'end_customer'` by default.
- When **linking** user to client (`user_clients`):
  - Ensure uniqueness by user (1:1).
  - On successful mapping, **update** `users.role` to `client_staff`.
  - **Do NOT** downgrade a `partner_admin` to `client_staff` automatically.

### 4.2 Products and Inventory

- Use `products.stock_qty` and `products.safety_stock` as the single source of inventory (MVP).
- On **order creation** (M4 T4-6b):
  - Wrap cart → order creation and stock deduction in a single DB transaction.
  - For each `order_items.quantity`, decrement `products.stock_qty`.
  - If resulting `stock_qty == 0`, set `products.status = 'sold_out'`.
- **Warn** or flag:
  - When `stock_qty ≤ safety_stock`, ensure 관리자 UI shows an alert (as per PRD).

### 4.3 Orders and Payments

- **Always** set:
  - `orders.partner_id` from the current partner context.
  - `orders.client_id` from session `client_id`.
  - `orders.user_id` from authenticated user if logged in (nullable as per ERD).
- **Use** `order_channel`:
  - `'link'` for standard web flow.
  - `'phone'` for 070/전화 주문.

---

## 5. Development Workflow Rules for AI

### 5.0 Error Fix and Code Change (필수)

- **오류 수정·기능 수정 시 반드시** 다음 순서를 따른다:
  1. **원인 분석**: 오류/이슈의 원인을 정리하여 사용자에게 전달한다.
  2. **수정 계획**: 수정 전/후 비교, 변경 대상(파일·위치·구체적 내용)을 명시한 수정 계획을 제시한다.
  3. **동의 후 수정**: 사용자가 수정 계획에 **동의한 뒤에만** 코드(또는 문서)를 수정한다.
- **Do NOT** 원인 분석·수정 계획 없이 바로 코드를 수정하지 않는다.
- 수정 후에는 해당 문서의 **변경 이력**에 일시(KST)·변경 내용을 기록한다. (see `rules/PROJECT_RULES.md` §7)

### 5.1 Before Implementing a Feature

- **Identify** the module and Phase from `docs/DEVELOPMENT_PLAN.md`.
- **Check** all declared 선행 Task for that Task; **do not** implement 후행 Task first.
- **Confirm** that the behavior exists and is consistent in:
  - `PRD.md`
  - `ERD.md`
  - `API_SPEC.md`
  - `PAGE_STRUCTURE_FLOW.md`

### 5.2 When Editing Code (Future src/app, API, etc.)

- **Keep** tenant-aware concerns centralized (middleware/helpers) when possible; **do not** copy-paste tenant filters ad hoc.
- **Guard** all write operations by:
  - Authenticated user (when required).
  - Tenant consistency (`partner_id`, `client_id` ownership).
- **Prefer**:
  - Creating small, focused modules per Task (예: T4-6b 전용 주문 트랜잭션 함수).
  - One clear responsibility per file where possible.

### 5.3 Tests and Seed Data

- Use `supabase/seed/test_data.sql` **only** for local/test environments.
- **Do NOT** rely on specific hard-coded UUIDs in business logic; these IDs are for tests only.
- When adding new test flows:
  - **Extend** `docs/TEST_PLAN.md` with new 시나리오.
  - **Update** or add seed data scripts accordingly.

---

## 6. Prohibited Actions

- **Do NOT**:
  - Create or use roles other than `partner_admin`, `client_staff`, `end_customer` in `users.role`.
  - Bypass tenant checks or use unscoped queries on multi-tenant tables.
  - Implement Super Admin UI or routes (platform-wide admin) unless PRD is updated first.
  - Modify existing migrations directly; always add new migrations.
  - Change documented behavior without also editing the corresponding docs and 기록된 변경 이력.

---

## 7. Examples (Do / Do NOT)

### 7.1 Role Update Example

- **Do**:
  - On 성공적인 `user_clients` 매핑:
    - Insert/Upsert into `user_clients`.
    - Update `users.role` from `end_customer` to `client_staff`.
- **Do NOT**:
  - Set `users.role` directly to `client_staff` without ensuring matching `user_clients` row.

### 7.2 Order Creation Example

- **Do**:
  - Use a transaction that:
    - Validates `client_id` from session.
    - Validates stock for each cart item.
    - Inserts into `orders` and `order_items`.
    - Deducts `products.stock_qty` and adjusts `status`.
- **Do NOT**:
  - Insert orders without `client_id`.
  - Deduct inventory outside of a transaction.

---

## 8. Maintenance of These Rules

- **Update** this file whenever:
  - New modules/Tasks are added to `DEVELOPMENT_PLAN.md`.
  - Role model or tenant model changes.
  - New critical data entities or cross-cutting concerns are introduced.
- **Mirror** meaningful rule changes into `rules/PROJECT_RULES.md` if they affect human developers, and vice versa.

---

## 9. 변경 이력

| 날짜 (KST) | 변경 내용 |
|------------|-----------|
| 2026-02-10 | §5.0 추가: 오류/기능 수정 시 원인분석·수정계획 제시 후 사용자 동의를 받은 뒤에만 코드 수정. PROJECT_RULES §7와 정합. |

