# API 명세서 (초안)

## 콜링크 쇼핑몰 플랫폼

**문서 버전:** 1.1  
**최종 수정일:** 2026-02-09 (KST)  
**기준 문서:** PRD v1.3, ERD v1.0

---

## 1. 공통 사항

### 1.1 기본 정보


| 항목               | 내용                                                         |
| ---------------- | ---------------------------------------------------------- |
| **Base URL**     | `https://api.{domain}/api` 또는 Next.js API Routes: `/api/`* |
| **인증 방식**        | JWT (NextAuth.js Session) / Bearer Token                   |
| **Content-Type** | `application/json`                                         |
| **Charset**      | `UTF-8`                                                    |


### 1.2 Multi-Tenancy

- 모든 파트너 소유 리소스 요청 시 `partner_id`는 세션/토큰에서 자동 추출
- 거래처 사용자 쇼핑몰 API는 `client_id` (또는 client_slug)를 세션/쿠키/헤더에서 추출

### 1.3 공통 응답 형식

**성공 (200)**

```json
{
  "success": true,
  "data": { ... }
}
```

**페이지네이션**

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**에러 (4xx, 5xx)**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "상품명은 필수입니다.",
    "details": []
  }
}
```

### 1.4 에러 코드


| HTTP | code             | 설명          |
| ---- | ---------------- | ----------- |
| 400  | VALIDATION_ERROR | 입력값 검증 실패   |
| 401  | UNAUTHORIZED     | 인증 필요       |
| 403  | FORBIDDEN        | 권한 없음       |
| 404  | NOT_FOUND        | 리소스 없음      |
| 409  | CONFLICT         | 중복 (slug 등) |
| 500  | INTERNAL_ERROR   | 서버 오류       |


---

## 2. 인증 API

### 2.1 SNS 로그인


| 메서드  | 경로                              | 설명                                                   |
| ---- | ------------------------------- | ---------------------------------------------------- |
| GET  | `/api/auth/signin/{provider}`   | 구글, 카카오, 네이버 로그인 시작                                  |
| GET  | `/api/auth/callback/{provider}` | OAuth 콜백 처리. **Merge Logic 구현 필수** — §7.3 장바구니 병합 참조 |
| POST | `/api/auth/signout`             | 로그아웃                                                 |


**로그인 시 장바구니 Merge Logic 필수** — 콜백 성공 직후(미들웨어/API) 세션 기반 장바구니를 사용자 장바구니로 병합

### 2.2 세션 조회


| 메서드 | 경로                  | 설명       |
| --- | ------------------- | -------- |
| GET | `/api/auth/session` | 현재 세션 정보 |


**Response**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "홍길동",
    "role": "partner_admin",
    "partnerId": "uuid",
    "clientId": "uuid"
  }
}
```

---

## 3. 파트너 어드민 API

### 3.1 기업 등록 (파트너)


| 메서드   | 경로                                  | 설명                                                                                                                                     |
| ----- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| POST  | `/api/verify/business-registration` | 사업자등록번호 검증. **파트너**: partners.business_registration_number, **거래처**: clients.business_registration_number 검증에 공통 사용. T1-3, 거래처 등록 시 호출 |
| POST  | `/api/partner/register`             | 기업 등록                                                                                                                                  |
| GET   | `/api/partner`                      | 내 파트너 정보 조회                                                                                                                            |
| PATCH | `/api/partner`                      | 파트너 정보 수정                                                                                                                              |


**POST /api/verify/business-registration Request**

```json
{
  "businessRegistrationNumber": "123-45-67890"
}
```

**Response (성공)**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "companyName": "주식회사 연미당",
    "businessStatus": "운영중"
  }
}
```

**Response (실패·미등록)**

```json
{
  "success": true,
  "data": {
    "valid": false,
    "message": "등록되지 않은 사업자등록번호입니다."
  }
}
```

- **용도**: 파트너 기업 등록(T1-3), 거래처 등록 시 사업자등록번호 유효성 검증. 외부 국세청/공공 API 연동 또는 형식 검증 구현

**POST /api/partner/register Request**

```json
{
  "businessRegistrationNumber": "123-45-67890",
  "companyName": "주식회사 연미당",
  "representative": "김대표",
  "address": "서울시 강남구 ...",
  "postcode": "06000",
  "businessType": "한식",
  "contact": "02-1234-5678",
  "fax": "02-1234-5679",
  "businessCategory": "외식업",
  "email": "admin@yenmidang.com",
  "tradeCategories": ["한식", "일식"],
  "subdomain": "yenmidang"
}
```

### 3.2 기업 등록 / 소속 매칭 (거래처 직원)


| 메서드  | 경로                    | 설명                                                               |
| ---- | --------------------- | ---------------------------------------------------------------- |
| GET  | `/api/clients/search` | 거래처 검색 (기업명). **자동완성(autocomplete)**: query 파라미터로 부분 입력 시 실시간 검색 |
| POST | `/api/user-clients`   | 소속 거래처 매칭                                                        |


**POST /api/user-clients Request**

```json
{
  "clientId": "uuid"
}
```

---

## 4. 상품 API

### 4.1 상품 CRUD (파트너)


| 메서드    | 경로                  | 설명             |
| ------ | ------------------- | -------------- |
| GET    | `/api/products`     | 상품 목록 (페이지네이션) |
| GET    | `/api/products/:id` | 상품 상세          |
| POST   | `/api/products`     | 상품 등록          |
| PATCH  | `/api/products/:id` | 상품 수정          |
| DELETE | `/api/products/:id` | 상품 삭제 (소프트)    |


**GET /api/products Query**


| 파라미터       | 타입     | 설명                      |
| ---------- | ------ | ----------------------- |
| page       | number | 페이지 (default: 1)        |
| limit      | number | 개수 (default: 20)        |
| status     | string | active, sold_out, draft |
| categoryId | uuid   | 카테고리 필터                 |
| keyword    | string | 검색어                     |


**POST /api/products Request**

```json
{
  "name": "베이비핑크 수국 꽃다발",
  "slug": "baby-pink-hydrangea",
  "shortDescription": "상큼한 봄의 향기",
  "descriptionHtml": "<p>상세 설명...</p>",
  "thumbnailUrl": "https://...",
  "basePrice": 39900,
  "salePrice": 34100,
  "status": "active",
  "stickerOptions": ["best", "new"],
  "deliveryMethods": ["parcel", "dawn"],
  "allowDeliveryDate": true,
  "categoryIds": ["uuid1"],
  "options": [
    { "name": "색상", "value": "핑크", "priceAdjustment": 0 }
  ],
  "images": [
    { "url": "https://...", "sortOrder": 0 }
  ],
  "quantity": 100,
  "safetyStock": 10
}
```

### 4.2 카테고리 API


| 메서드    | 경로                    | 설명           |
| ------ | --------------------- | ------------ |
| GET    | `/api/categories`     | 카테고리 목록 (계층) |
| POST   | `/api/categories`     | 카테고리 등록      |
| PATCH  | `/api/categories/:id` | 카테고리 수정      |
| DELETE | `/api/categories/:id` | 카테고리 삭제      |


### 4.3 재고 API


| 메서드   | 경로                            | 설명    |
| ----- | ----------------------------- | ----- |
| GET   | `/api/products/:id/inventory` | 재고 조회 |
| PATCH | `/api/products/:id/inventory` | 재고 수정 |


---

## 5. 거래처 API

### 5.1 거래처 CRUD (파트너)


| 메서드    | 경로                      | 설명             |
| ------ | ----------------------- | -------------- |
| GET    | `/api/clients`          | 거래처 목록         |
| GET    | `/api/clients/:id`      | 거래처 상세         |
| POST   | `/api/clients`          | 거래처 등록         |
| PATCH  | `/api/clients/:id`      | 거래처 수정         |
| PATCH  | `/api/clients/:id/slug` | Slug(링크 주소) 저장 |
| DELETE | `/api/clients/:id`      | 거래처 삭제         |


**POST/PATCH 거래처 요청 시 logo_url** (선택): CI 이미지 URL. 전용 URL 쇼핑몰 헤더 로고 영역에 노출. 이미지 업로드 후 URL 전달. **business_registration_number** 검증 시 `/api/verify/business-registration` 호출 (clients 테이블).

**PATCH /api/clients/:id/slug Request**

```json
{
  "slug": "samsungelec"
}
```

**Response (전용 URL)**

```json
{
  "url": "https://yenmidang.shopping.com/samsungelec"
}
```

### 5.2 070 번호 연동 API (client_call_070_configs)


| 메서드    | 경로                          | 설명                                            |
| ------ | --------------------------- | --------------------------------------------- |
| GET    | `/api/clients/:id/call-070` | 거래처 070 연동 설정 조회                              |
| POST   | `/api/clients/:id/call-070` | 070 연동 설정 등록. CallCloud Selenium 자동화 트리거 (옵션) |
| PATCH  | `/api/clients/:id/call-070` | 070 연동 설정 수정                                  |
| DELETE | `/api/clients/:id/call-070` | 070 연동 설정 삭제                                  |


**POST /api/clients/:id/call-070 Request**

```json
{
  "call_070_number": "07012341234",
  "greeting_message": "안녕하세요 {고객사명}에 전화 주셔서 감사합니다.",
  "industry": "화훼",
  "admin_name": "홍길동",
  "admin_email": "hong@gmail.com",
  "admin_phone": "01012344321",
  "sms_text_template": "안녕하세요 {고객사명}입니다."
}
```

- `service_url`(서비스 URL)은 클라이언트에서 `https://{subdomain}.shopping.com/{clientSlug}` 로 자동 생성 후 Selenium에 전달
- `trigger_callcloud`: true 시 CallCloud 백오피스 자동화 수행 (Selenium)

---

## 6. 주문 API

### 6.1 주문 목록 (파트너)


| 메서드 | 경로            | 설명             |
| --- | ------------- | -------------- |
| GET | `/api/orders` | 주문 목록 (페이지네이션) |


**Query**


| 파라미터               | 타입     | 설명     |
| ------------------ | ------ | ------ |
| page, limit        | number | 페이지네이션 |
| clientId           | uuid   | 거래처 필터 |
| status             | string | 주문 상태  |
| startDate, endDate | string | 기간     |


### 6.2 주문 상세·상태 변경 (파트너)


| 메서드   | 경로                       | 설명              |
| ----- | ------------------------ | --------------- |
| GET   | `/api/orders/:id`        | 주문 상세           |
| PATCH | `/api/orders/:id/status` | 상태 변경 (송장 입력 등) |


**PATCH /api/orders/:id/status Request**

```json
{
  "status": "shipping",
  "trackingNumber": "1234567890123"
}
```

### 6.3 주문 생성 API (통합) — ~~POST /api/checkout, POST /api/store/orders 폐기~~

**Endpoint:** `POST /api/orders`

장바구니 구매(CART)와 바로 구매(DIRECT)를 **단일 엔드포인트**로 통합. 주문 생성, 재고 차감, 장바구니 비우기(CART 유형 시)를 원자적 트랜잭션으로 처리합니다.


| 항목       | 내용                                                             |
| -------- | -------------------------------------------------------------- |
| **권한**   | 로그인한 사용자 (User Role: CLIENT_USER 이상)                           |
| **트랜잭션** | **Atomic Transaction 필수** — 주문 생성·재고 차감·장바구니 삭제(CART 시) 원자 처리  |
| **폐기**   | ~~POST /api/checkout~~, ~~POST /api/store/orders~~ → 본 API로 통합 |


#### Request Body

```json
{
  "type": "CART",
  "cart_ids": ["uuid1", "uuid2"],
  "direct_items": [],
  "shipping_info": {
    "recipient_name": "홍길동",
    "recipient_phone": "010-1234-5678",
    "zip_code": "12345",
    "address": "서울시 강남구...",
    "detail_address": "101호",
    "request_memo": "문 앞에 놔주세요",
    "desired_delivery_date": "2026-02-14"
  },
  "payment_info": {
    "method": "BANK_TRANSFER",
    "depositor_name": "홍길동",
    "total_amount": 34100
  }
}
```


| 필드                                  | 타입       | 필수       | 설명                                        |
| ----------------------------------- | -------- | -------- | ----------------------------------------- |
| type                                | string   | O        | `CART` | `DIRECT` — 주문 유형                 |
| cart_ids                            | string[] | CART 시   | 장바구니 아이템 ID. 비어있으면 전체 주문                  |
| direct_items                        | array    | DIRECT 시 | `[{ product_id, quantity, options }]`     |
| shipping_info                       | object   | O        | 배송지 정보                                    |
| shipping_info.recipient_name        | string   | O        | 수령인                                       |
| shipping_info.recipient_phone       | string   | O        | 수령인 연락처                                   |
| shipping_info.zip_code              | string   | O        | 우편번호                                      |
| shipping_info.address               | string   | O        | 주소                                        |
| shipping_info.detail_address        | string   | -        | 상세주소                                      |
| shipping_info.request_memo          | string   | -        | 배송 요청사항                                   |
| shipping_info.desired_delivery_date | string   | -        | 희망 배송일 (YYYY-MM-DD)                       |
| payment_info                        | object   | O        | 결제 정보                                     |
| payment_info.method                 | string   | O        | CARD, BANK_TRANSFER, CORPORATE_CREDIT(외상) |
| payment_info.depositor_name         | string   | -        | 무통장 입금 시 입금자명                             |
| payment_info.total_amount           | number   | O        | 총액 (서버 검증용)                               |


- `partner_id`, `client_id`는 세션/쿠키에서 자동 추출

#### Response — 성공 (200 OK)

```json
{
  "success": true,
  "data": {
    "order_id": "ord_20260209_xxxx",
    "total_amount": 34100,
    "status": "PENDING_PAYMENT"
  },
  "message": "주문이 정상적으로 접수되었습니다."
}
```

#### Response — 실패 (Error Codes)


| Status | code             | message                        | 해결 가이드                |
| ------ | ---------------- | ------------------------------ | --------------------- |
| 400    | OUT_OF_STOCK     | "상품명(옵션)의 재고가 부족합니다. (현재: N개)" | 장바구니로 돌려보내거나 수량 조정 유도 |
| 400    | PRICE_MISMATCH   | "상품 가격이 변동되었습니다."              | 장바구니 새로고침 유도          |
| 400    | INVALID_CART     | "장바구니가 비어있습니다."                | 상품 목록으로 이동            |
| 409    | TRANSACTION_FAIL | "주문 처리 중 오류가 발생했습니다."          | 잠시 후 재시도              |


---

### 6.4 트랜잭션 명세 (Transaction Specification)

`POST /api/orders`는 데이터 무결성을 위해 **Atomic Transaction(원자적 트랜잭션)**으로 처리되어야 합니다.

#### Logic Flow

**1. 검증 (Validation)** — 사용자 세션, client_id 유효성, cart_ids 또는 direct_items 존재 확인

**2. 재고 및 가격 검증** — products.stock_qty 확인, DB 가격 합계와 total_amount 일치 확인

**3. 트랜잭션 실행**


| 순서  | 작업       | 상세                                                           |
| --- | -------- | ------------------------------------------------------------ |
| (A) | 주문 생성    | Orders Insert                                                |
| (B) | 주문 상세    | OrderItems Insert                                            |
| (C) | 재고 차감    | `UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?` |
| (D) | 품절 처리    | stock_qty=0 시 status='SOLD_OUT'                              |
| (E) | 장바구니 비우기 | type=CART 시 CartItems DELETE                                 |


**4. 커밋** — 모든 단계 성공 시 반영

**5. 알림 (Optional)** — 파트너/구매자 알림

#### 구현 요구사항

- Supabase Transaction 또는 RPC로 원자성 보장
- 재고 필드: **products.stock_qty** (Decision Log: product_inventory 대신 products 통합)

---

## 7. 거래처 사용자 쇼핑몰 API

### 7.1 공통

- Base: `https://{partner}.shopping.com/api` (동일 도메인)
- `client_id` 또는 `client_slug`는 쿠키/세션에서 자동 적용

### 7.2 상품 조회 (쇼핑몰)


| 메서드 | 경로                          | 설명          |
| --- | --------------------------- | ----------- |
| GET | `/api/store/products`       | 상품 목록 (PLP) |
| GET | `/api/store/products/:slug` | 상품 상세 (PDP) |
| GET | `/api/store/categories`     | 카테고리 목록     |
| GET | `/api/store/banners`        | 배너 목록       |


**GET /api/store/products Query**


| 파라미터        | 타입     | 설명                                     |
| ----------- | ------ | -------------------------------------- |
| categoryId  | uuid   | 카테고리 필터                                |
| sort        | string | newest, price_asc, price_desc, popular |
| page, limit | number | 페이지네이션                                 |


### 7.3 장바구니 API


| 메서드    | 경로                          | 설명      |
| ------ | --------------------------- | ------- |
| GET    | `/api/store/cart`           | 장바구니 조회 |
| POST   | `/api/store/cart/items`     | 장바구니 담기 |
| PATCH  | `/api/store/cart/items/:id` | 수량 변경   |
| DELETE | `/api/store/cart/items/:id` | 삭제      |


#### 장바구니 정책 (Cart Policy) — 세션 기반 → 로그인 시 병합

**비회원 (Guest):**

- 브라우저 쿠키에 고유 `session_id` (UUID) 발급
- DB `carts` 테이블에 `user_id=NULL`, `session_id={UUID}` 로 저장
- 장점: 기기 변경 전까지 장바구니 유지, DB 기반 분석 가능

**로그인 시 Merge Logic (구현 필수):**  
로그인 성공 시점(Auth Callback)에 미들웨어/API로 동작.


| Case   | 조건             | 동작                                                                                                  |
| ------ | -------------- | --------------------------------------------------------------------------------------------------- |
| Case 1 | 기존 사용자 장바구니 없음 | 현재 `session_id` 장바구니의 `user_id` 업데이트                                                                |
| Case 2 | 기존 사용자 장바구니 있음 | 세션 장바구니의 `cart_items` 를 기존 사용자 장바구니로 이동(`UPDATE cart_id`). 중복 상품은 수량 합산(`quantity +`). 빈 세션 장바구니 삭제 |


**POST /api/store/cart/items Request**

```json
{
  "productId": "uuid",
  "quantity": 2,
  "optionJson": { "색상": "핑크", "포장": "기본" }
}
```

### 7.4 최근 본 상품 API

**비로그인 시 비활성화** — 로그인한 사용자만 사용 가능. 비로그인 시 401 반환 또는 API 호출 불가.


| 메서드    | 경로                             | 설명                                                                       |
| ------ | ------------------------------ | ------------------------------------------------------------------------ |
| GET    | `/api/store/product-views`     | 최근 본 상품 목록 (페이지네이션). Empty 시 빈 배열 반환. **로그인 필수**                         |
| POST   | `/api/store/product-views`     | PDP 진입 시 기록 (user, product, client 기준 upsert → viewed_at 갱신). **로그인 필수** |
| DELETE | `/api/store/product-views/:id` | 최근 본 상품 삭제. **로그인 필수**                                                   |


**GET /api/store/product-views Query**


| 파라미터  | 타입     | 설명               |
| ----- | ------ | ---------------- |
| page  | number | 페이지 (default: 1) |
| limit | number | 개수 (default: 20) |


**GET Response (상품 정보 포함)**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "productId": "uuid",
      "productName": "우리집 강아지를 닮은, 비숑 꽃다발...",
      "thumbnailUrl": "https://...",
      "basePrice": 15900,
      "salePrice": 9900,
      "pointsRate": 3,
      "viewedAt": "2025-02-06T10:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

**POST /api/store/product-views Request**

```json
{
  "productId": "uuid"
}
```

- `client_id`는 세션/쿠키에서 자동 추출

### 7.5 주문·결제 API (쇼핑몰)


| 메서드  | 경로                               | 설명                                                                                        |
| ---- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| POST | `/api/orders`                    | **주문 생성 (통합)**. type=CART | DIRECT. §6.3 참조                                               |
| GET  | `/api/store/orders/:id`          | 주문 상세                                                                                     |
| POST | `/api/store/orders/:id/pay`      | 결제 요청 (PG 연동). **결제 완료 시 products.stock_qty 차감, quantity=0 시 products.status → sold_out** |
| GET  | `/api/store/orders/:id/complete` | 주문 완료 확인                                                                                  |


**※ 주문 생성은 `POST /api/orders` 사용. 기존 `POST /api/store/orders` 폐기.**

### 7.6 관심상품 API (Wishlist)


| 메서드    | 경로                        | 설명                                                           |
| ------ | ------------------------- | ------------------------------------------------------------ |
| GET    | `/api/store/wishlist`     | 관심상품 목록 (페이지네이션). wishlist_items 기반. 상품 정보(썸네일·상품명·가격) 포함    |
| POST   | `/api/store/wishlist`     | 관심상품 담기. (user_id, product_id, client_id) UK. 중복 시 무시 또는 200 |
| DELETE | `/api/store/wishlist/:id` | 관심상품 삭제                                                      |


**POST /api/store/wishlist Request**

```json
{
  "productId": "uuid"
}
```

- `client_id`는 세션/쿠키에서 자동 추출. T6-5 대응

### 7.7 마이페이지 API


| 메서드    | 경로                            | 설명      |
| ------ | ----------------------------- | ------- |
| GET    | `/api/store/me/orders`        | 내 주문 목록 |
| GET    | `/api/store/me/orders/:id`    | 주문 상세   |
| GET    | `/api/store/me/addresses`     | 배송지 목록  |
| POST   | `/api/store/me/addresses`     | 배송지 등록  |
| PATCH  | `/api/store/me/addresses/:id` | 배송지 수정  |
| DELETE | `/api/store/me/addresses/:id` | 배송지 삭제  |


---

## 8. 대시보드·통계 API

### 8.1 대시보드 (파트너)


| 메서드 | 경로                            | 설명                |
| --- | ----------------------------- | ----------------- |
| GET | `/api/dashboard/summary`      | 현황판 (매출, 주문 건수 등) |
| GET | `/api/dashboard/sales-trend`  | 주간/월간 매출 추이       |
| GET | `/api/dashboard/top-products` | 인기 상품 Top 5       |


---

## 9. 공지·리뷰 API (후순위)

### 9.1 공지사항

**파트너 어드민**


| 메서드    | 경로                 | 설명                                                  |
| ------ | ------------------ | --------------------------------------------------- |
| GET    | `/api/notices`     | 공지 목록 (페이지네이션). partner_id 필터. clientId 쿼리로 거래처별 필터 |
| GET    | `/api/notices/:id` | 공지 상세                                               |
| POST   | `/api/notices`     | 공지 등록 (파트너). client_id null이면 전체 공지                 |
| PATCH  | `/api/notices/:id` | 공지 수정                                               |
| DELETE | `/api/notices/:id` | 공지 삭제                                               |


**쇼핑몰 (Storefront)**


| 메서드 | 경로                   | 설명                                                                  |
| --- | -------------------- | ------------------------------------------------------------------- |
| GET | `/api/store/notices` | 공지 목록 (페이지네이션). client_id 세션 기준. is_pinned=true 우선, created_at DESC |


**GET /api/store/notices Query:** page, limit

### 9.2 리뷰

**쇼핑몰 (Storefront)**


| 메서드  | 경로                                  | 설명                                                                    |
| ---- | ----------------------------------- | --------------------------------------------------------------------- |
| GET  | `/api/store/products/:slug/reviews` | 상품별 리뷰 목록 (PDP). 페이지네이션. rating, content, admin_reply. is_blind 시 마스킹 |
| POST | `/api/store/orders/:id/reviews`     | 리뷰 작성. **구매 확정(confirmed_purchase) 후만 가능**. order_items 기준 상품별 리뷰     |


**POST /api/store/orders/:id/reviews Request**

```json
{
  "productId": "uuid",
  "rating": 5,
  "content": "맛있어요!"
}
```

**파트너 어드민**


| 메서드   | 경로                       | 설명                                       |
| ----- | ------------------------ | ---------------------------------------- |
| GET   | `/api/reviews`           | 리뷰 목록 (페이지네이션). partner_id, productId 필터 |
| PATCH | `/api/reviews/:id/reply` | 관리자 답글 (admin_reply)                     |


---

## 10. 파일 업로드

### 10.1 상품 이미지


| 메서드  | 경로                  | 설명                  |
| ---- | ------------------- | ------------------- |
| POST | `/api/upload/image` | 이미지 업로드 (Multipart) |


**Response**

```json
{
  "url": "https://storage.../image.jpg"
}
```

---

## 변경 이력


| 날짜         | 시간    | 변경 내용                                                                                                |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------- |
| 2025-02-06 | 16:00 | 7.4 주문/결제 API: 결제 완료 시 재고 차감·quantity=0→sold_out 자동 전환                                               |
| 2025-02-06 | 19:00 | 7.4 최근 본 상품 API 추가 (product_views)                                                                   |
| 2026-02-09 | 14:27 | 문서 일시 업데이트                                                                                           |
| 2026-02-09 | -     | T1-3 대응: POST /api/verify/business-registration 추가. partners/clients business_registration_number 검증 |
| 2026-02-09 | -     | §7.6 관심상품 API(wishlist) 추가. §9 공지·리뷰 상세 보완(store notices, reviews 상세)                                |
| 2026-02-09 | 15:32 | 문서 일시 업데이트 (한국 현지 시간 KST 반영)                                                                         |
| 2026-02-09 | -     | §6.3 Checkout API (POST /api/checkout) 추가: 장바구니→주문 변환, 재고 차감, 장바구니 비우기                               |
| 2026-02-10 | -     | §2.1, §7.3 장바구니 정책(Cart Policy): 세션 기반 생성·로그인 시 병합(Merge Logic) 필수 명시                                |
| 2026-02-10 | -     | §7.4 최근 본 상품: 비로그인 시 비활성화 (로그인 필수)                                                                   |
| 2026-02-09 | -     | §6.4 트랜잭션 명세 (Transaction Specification) 추가: Atomic Transaction 로직 흐름 정의                             |
| 2026-02-09 | -     | §5.2 070 번호 연동 API (client_call_070_configs) 추가: GET/POST/PATCH/DELETE /api/clients/:id/call-070     |


---

*본 문서는 초안이며, 구현 진행에 따라 상세 스펙이 보완됩니다.*