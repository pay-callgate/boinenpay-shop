# ERD (Entity Relationship Diagram)
## 콜링크 쇼핑몰 플랫폼 - 데이터 모델 설계

**문서 버전:** 1.0  
**최종 수정일:** 2026-02-09 15:32 (KST)  
**프로젝트명:** Call-Link Shopping Mall

---

## 1. 개요

본 문서는 콜링크 쇼핑몰 플랫폼의 핵심 데이터 모델을 정의합니다.
- **Multi-Tenancy**: `partner_id` 기반 테넌트 격리
- **주문 출처 추적**: `client_id` 필수 (거래처별 실적)
- **기업 검증**: 파트너/거래처 모두 사업자등록번호 검증 필수

---

## 2. ER 다이어그램 (Mermaid)

```mermaid
erDiagram
    partners ||--o{ clients : "has"
    clients ||--o| client_call_070_configs : "070연동"
    partners ||--o{ products : "has"
    partners ||--o{ banners : "has"
    partners ||--o{ notices : "has"
    
    users ||--o| partner_admins : "is_admin_of"
    partners ||--o{ partner_admins : "has"
    
    users ||--o| user_clients : "belongs_to"
    clients ||--o{ user_clients : "has"
    
    clients ||--o{ orders : "source"
    partners ||--o{ orders : "owns"
    users ||--o{ orders : "places"
    
    orders ||--o{ order_items : "contains"
    products ||--o{ order_items : "ordered"
    
    orders ||--o{ order_status_history : "has"
    orders ||--o| payments : "has"
    
    products ||--o{ product_categories : "belongs_to"
    partners ||--o{ product_categories : "has"
    products }o--o{ product_categories : "many-to-many"
    
    products ||--o{ product_options : "has"
    products ||--o{ product_images : "has"
    products ||--o| product_inventory : "has"
    
    users ||--o{ carts : "has"
    clients ||--o{ carts : "source"
    carts ||--o{ cart_items : "contains"
    products ||--o{ cart_items : "in"
    
    users ||--o{ wishlist_items : "has"
    products ||--o{ wishlist_items : "in"
    clients ||--o{ wishlist_items : "source"
    
    users ||--o{ product_views : "has"
    products ||--o{ product_views : "in"
    clients ||--o{ product_views : "source"
    
    users ||--o{ addresses : "has"
    users ||--o{ reviews : "writes"
    products ||--o{ reviews : "has"
    orders ||--o{ reviews : "from"
    
    partners {
        uuid id PK
        string subdomain UK
        string business_registration_number UK
        string company_name
        string representative
        string address
        string postcode
        string business_type
        string contact
        string fax
        string business_category
        string email
        enum verification_status
        timestamp verified_at
        jsonb trade_categories
        timestamps
    }
    
    clients {
        uuid id PK
        uuid partner_id FK
        string slug UK
        string name
        string logo_url
        string business_registration_number
        enum verification_status
        string contact_name
        string contact_phone
        string contact_email
        boolean call_070_connected
        timestamps
    }
    
    client_call_070_configs {
        uuid id PK
        uuid client_id FK UK
        string call_070_number
        string greeting_message
        string industry
        string admin_name
        string admin_email
        string admin_phone
        string sms_text_template
        boolean callcloud_registered
        timestamps
    }
    
    users {
        uuid id PK
        string email UK
        string name
        string phone
        enum role
        string provider
        string provider_id
        timestamps
    }
    
    partner_admins {
        uuid id PK
        uuid user_id FK
        uuid partner_id FK
        timestamps
    }
    
    user_clients {
        uuid id PK
        uuid user_id FK UK
        uuid client_id FK
        enum role
        timestamps
    }
    
    products {
        uuid id PK
        uuid partner_id FK
        string name
        string slug
        string short_description
        text description_html
        string thumbnail_url
        decimal base_price
        decimal sale_price
        int stock_qty
        int safety_stock
        enum status
        jsonb sticker_options
        jsonb delivery_methods
        boolean allow_delivery_date
        timestamps
    }
    
    product_categories {
        uuid id PK
        uuid partner_id FK
        uuid parent_id FK
        string name
        string slug
        int sort_order
        timestamps
    }
    
    product_category_mappings {
        uuid product_id FK
        uuid category_id FK
        PK product_id category_id
    }
    
    product_options {
        uuid id PK
        uuid product_id FK
        string name
        string value
        decimal price_adjustment
        int sort_order
        timestamps
    }
    
    product_images {
        uuid id PK
        uuid product_id FK
        string url
        int sort_order
        timestamps
    }
    
    product_inventory {
        uuid id PK
        uuid product_id FK UK
        int quantity
        int safety_stock
        timestamps
    }
    
    banners {
        uuid id PK
        uuid partner_id FK
        string image_url
        string link_url
        int sort_order
        boolean is_active
        timestamps
    }
    
    orders {
        uuid id PK
        uuid partner_id FK
        uuid client_id FK
        uuid user_id FK "nullable"
        string order_no UK
        enum status
        enum order_channel
        decimal total_amount
        string payment_method
        enum payment_status
        string shipping_name
        string shipping_phone
        string shipping_postcode
        string shipping_address
        string shipping_detail
        string tracking_number
        timestamps
    }
    
    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        string product_name
        jsonb option_json
        int quantity
        decimal unit_price
        decimal total_price
        timestamps
    }
    
    order_status_history {
        uuid id PK
        uuid order_id FK
        enum status
        text memo
        timestamps
    }
    
    payments {
        uuid id PK
        uuid order_id FK
        string pg_provider
        string pg_txn_id
        decimal amount
        enum status
        timestamp paid_at
        timestamps
    }
    
    carts {
        uuid id PK
        uuid user_id FK "nullable"
        string session_id "guest"
        uuid client_id FK
        timestamps
    }
    
    cart_items {
        uuid id PK
        uuid cart_id FK
        uuid product_id FK
        jsonb option_json
        int quantity
        timestamps
    }
    
    wishlist_items {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        uuid client_id FK
        timestamps
    }
    
    product_views {
        uuid id PK
        uuid user_id FK
        uuid product_id FK
        uuid client_id FK
        timestamp viewed_at
        timestamps
    }
    
    addresses {
        uuid id PK
        uuid user_id FK
        string name
        string phone
        string postcode
        string address
        string detail
        boolean is_default
        timestamps
    }
    
    reviews {
        uuid id PK
        uuid product_id FK
        uuid order_id FK
        uuid user_id FK
        int rating
        text content
        boolean is_blind
        text admin_reply
        timestamps
    }
    
    notices {
        uuid id PK
        uuid partner_id FK
        uuid client_id FK "nullable"
        string title
        text content
        boolean is_pinned
        timestamps
    }
```

---

## 3. 엔티티 상세 정의

### 3.1 파트너·거래처·사용자

#### partners (파트너사)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| subdomain | VARCHAR(50) | ✓ | URL용 (예: yenmidang). UK |
| business_registration_number | VARCHAR(12) | ✓ | 사업자등록번호. UK |
| company_name | VARCHAR(100) | ✓ | 사업자명 |
| representative | VARCHAR(50) | ✓ | 대표자 |
| postcode | VARCHAR(10) | | 우편번호 |
| address | VARCHAR(255) | ✓ | 사업장 소재지 |
| business_type | VARCHAR(50) | | 사업종류 (한중식 등) |
| contact | VARCHAR(20) | | 연락처 |
| fax | VARCHAR(20) | | FAX |
| business_category | VARCHAR(50) | | 사업종목 |
| email | VARCHAR(100) | ✓ | 이메일 |
| trade_categories | JSONB | | 취급업종 (한식, 일식 등 체크 배열) |
| verification_status | ENUM | ✓ | pending, verified, rejected |
| verified_at | TIMESTAMP | | 검증 완료 시각 |
| created_at, updated_at | TIMESTAMP | ✓ | |

**인덱스:** subdomain (UK), business_registration_number (UK)

---

#### clients (거래처)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| partner_id | UUID | ✓ | FK → partners |
| slug | VARCHAR(50) | ✓ | 영문명 (예: samsungelec). UK (partner_id 내) |
| name | VARCHAR(100) | ✓ | 거래처명(한글) |
| logo_url | VARCHAR(500) | | CI 이미지 URL. 전용 URL 쇼핑몰 헤더 로고 영역에 노출 |
| business_registration_number | VARCHAR(12) | | 사업자등록번호 |
| verification_status | ENUM | ✓ | pending, verified, rejected |
| contact_name | VARCHAR(50) | | 담당자명 |
| contact_phone | VARCHAR(20) | | 담당자 연락처 |
| contact_email | VARCHAR(100) | | 담당자 이메일 |
| call_070_connected | BOOLEAN | ✓ | 070 연동 여부. default false |
| created_at, updated_at | TIMESTAMP | ✓ | |

**전용 URL:** `https://{partners.subdomain}.shopping.com/{clients.slug}`

**인덱스:** (partner_id, slug) UK

---

#### client_call_070_configs (070 번호 연동 설정)

전용 주문 URL과 070 서비스 번호를 매칭·관리. CallCloud 백오피스 신규 고객사 등록에 필요한 입력 정보 저장.

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| client_id | UUID | ✓ | FK → clients. UK (거래처당 1건) |
| call_070_number | VARCHAR(20) | ✓ | 070 서비스 번호 (예: 07012341234, 하이픈 없이 저장 권장) |
| greeting_message | VARCHAR(500) | | 인사말 멘트. 예: "안녕하세요 {고객사명}에 전화 주셔서 감사합니다." |
| industry | VARCHAR(50) | | 업종 (예: 화훼, IT/정보통신). CallCloud 폼용 |
| admin_name | VARCHAR(50) | | 관리자명 (CallCloud 등록용) |
| admin_email | VARCHAR(100) | | 관리자 이메일 |
| admin_phone | VARCHAR(20) | | 관리자 전화번호 (하이픈 없이) |
| sms_text_template | TEXT | | SMS 텍스트 템플릿. 예: "안녕하세요 {고객사명}입니다." |
| callcloud_registered | BOOLEAN | ✓ | CallCloud 등록 완료 여부. default false |
| created_at, updated_at | TIMESTAMP | ✓ | |

**비즈니스 규칙:**
- 전용 URL은 `https://{partners.subdomain}.{domain}/{clients.slug}` 로 파생 (이 테이블에 저장하지 않음)
- [070번호 연결하기] 버튼 클릭 시 입력 팝업 → 본 테이블 저장 → CallCloud 백오피스 자동화(Selenium) 수행
- callcloud_registered=true 시 clients.call_070_connected=true 동기화

**인덱스:** client_id (UK)

---

#### users (회원)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| email | VARCHAR(100) | ✓ | UK |
| name | VARCHAR(50) | | |
| phone | VARCHAR(20) | | |
| role | ENUM | ✓ | partner_admin, client_staff, end_customer |
| provider | VARCHAR(20) | | google, kakao, naver |
| provider_id | VARCHAR(100) | | SNS 제공자 ID |
| created_at, updated_at | TIMESTAMP | ✓ | |

**인덱스:** email (UK), (provider, provider_id) UK

---

#### partner_admins (파트너 관리자)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| user_id | UUID | ✓ | FK → users |
| partner_id | UUID | ✓ | FK → partners |
| created_at, updated_at | TIMESTAMP | ✓ | |

**인덱스:** (user_id, partner_id) UK

---

#### user_clients (거래처 직원 매핑)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| user_id | UUID | ✓ | FK → users. **UK (1:1)** |
| client_id | UUID | ✓ | FK → clients |
| role | ENUM | ○ | member, admin. ~~admin=거래처 관리자~~ (제외). 현행: member만 사용. 전용 링크는 파트너 Admin이 문자/카톡 전달 |
| created_at, updated_at | TIMESTAMP | ✓ | |

**제약:** 한 사용자는 하나의 거래처에만 소속 (user_id UK)

**비즈니스 규칙:** role=client_staff인 user는 반드시 user_clients 매핑 필요. **지정 주체·시점**: (A) 링크 진입 `/{sub}/{clientSlug}` 시 로그인 완료 즉시 해당 client_id로 **자동** insert/update. (B) 파트너 메인 `/{sub}` 진입 후 주문 시도 시 user_clients 없으면 [소속 기업 찾기] 팝업에서 **수동** 검색·선택→매핑.

---

### 3.2 상품

#### products (상품)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| partner_id | UUID | ✓ | FK → partners |
| name | VARCHAR(200) | ✓ | 상품명 |
| slug | VARCHAR(100) | ✓ | URL용. UK (partner_id 내) |
| short_description | VARCHAR(500) | ✓ | PDP 상단 간략 설명 (꽃말 등) |
| description_html | TEXT | | 상세 페이지 HTML |
| thumbnail_url | VARCHAR(500) | | 썸네일 URL |
| base_price | DECIMAL(12,2) | | 정가 (할인 없으면 생략 가능) |
| sale_price | DECIMAL(12,2) | ✓ | 판매가 |
| status | ENUM | ✓ | active, sold_out, draft |
| sticker_options | JSONB | | 스티커 스타일 배열. best, hit, new, sale, hot (인기상품 BEST, 추천상품 HIT, 최신상품 NEW, 할인상품 SALE, 특가상품 HOT) |
| delivery_methods | JSONB | ✓ | 택배, 새벽, 퀵, 매장픽업 (1개 이상) |
| allow_delivery_date | BOOLEAN | ✓ | 희망 날짜 허용 |
| **stock_qty** | **INT** | **✓** | **현재 재고. [Decision] products 테이블 통합. default 0** |
| **safety_stock** | **INT** | **✓** | **안전 재고. 이 수치 이하 시 파트너 알림. default 10** |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

#### product_categories (상품 카테고리)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| partner_id | UUID | ✓ | FK → partners |
| parent_id | UUID | | FK → product_categories (대분류/소분류 계층) |
| name | VARCHAR(50) | ✓ | 꽃다발, Best Seller 등 |
| slug | VARCHAR(50) | ✓ | |
| sort_order | INT | ✓ | 노출 순서 |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

#### product_category_mappings (상품-카테고리)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| product_id | UUID | ✓ | FK → products |
| category_id | UUID | ✓ | FK → product_categories |

**PK:** (product_id, category_id)

---

#### product_options (상품 옵션)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| product_id | UUID | ✓ | FK → products |
| name | VARCHAR(50) | ✓ | 사이즈, 색상 등 |
| value | VARCHAR(100) | ✓ | 옵션 값 |
| price_adjustment | DECIMAL(12,2) | | 가격 가감 |
| sort_order | INT | ✓ | |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

#### product_images (상품 이미지)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| product_id | UUID | ✓ | FK → products |
| url | VARCHAR(500) | ✓ | |
| sort_order | INT | ✓ | |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

#### product_inventory (재고) — **후순위 (멀티 창고 시 분리)**

**[Decision Log] MVP 단계:** 재고는 **products.stock_qty**, **products.safety_stock** 로 통합. product_inventory 테이블은 멀티 창고 확장 시 도입.

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| product_id | UUID | ✓ | FK → products. UK |
| quantity | INT | ✓ | 현재 재고 |
| safety_stock | INT | ✓ | Safety Stock |
| updated_at | TIMESTAMP | ✓ | |

**비즈니스 규칙 (재고) — products 통합 시:**
- 주문/결제 완료 시 order_items 수량만큼 **products.stock_qty** 차감
- stock_qty=0 도달 시 products.status를 sold_out으로 자동 전환
- stock_qty ≤ safety_stock 시 관리자 알림 (대시보드·재고 관리)

---

### 3.3 배너

#### banners (배너)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| partner_id | UUID | ✓ | FK → partners |
| image_url | VARCHAR(500) | ✓ | |
| link_url | VARCHAR(500) | | |
| sort_order | INT | ✓ | |
| is_active | BOOLEAN | ✓ | default true |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

### 3.4 주문·결제

#### orders (주문)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| partner_id | UUID | ✓ | FK → partners |
| client_id | UUID | ✓ | FK → clients (출처 필수) |
| user_id | UUID | | FK → users. 비회원 주문 시 null |
| order_no | VARCHAR(20) | ✓ | 주문번호. UK |
| status | ENUM | ✓ | received, confirmed, shipping, delivered, confirmed_purchase, cancelled, returned |
| order_channel | ENUM | ✓ | link, phone |
| total_amount | DECIMAL(12,2) | ✓ | |
| payment_method | VARCHAR(50) | | card, kakao, toss, callgate_visible 등 |
| payment_status | ENUM | ✓ | pending, paid, failed, refunded |
| shipping_name | VARCHAR(50) | ✓ | |
| shipping_phone | VARCHAR(20) | ✓ | |
| shipping_postcode | VARCHAR(10) | ✓ | |
| shipping_address | VARCHAR(255) | ✓ | |
| shipping_detail | VARCHAR(100) | | |
| tracking_number | VARCHAR(50) | | 송장번호 |
| created_at, updated_at | TIMESTAMP | ✓ | |

**인덱스:** order_no (UK), (partner_id, created_at), (client_id, created_at)

---

#### order_items (주문 상품)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| order_id | UUID | ✓ | FK → orders |
| product_id | UUID | ✓ | FK → products |
| product_name | VARCHAR(200) | ✓ | 주문 시점 상품명 |
| option_json | JSONB | | 선택 옵션 |
| quantity | INT | ✓ | |
| unit_price | DECIMAL(12,2) | ✓ | |
| total_price | DECIMAL(12,2) | ✓ | |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

#### order_status_history (주문 상태 이력)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| order_id | UUID | ✓ | FK → orders |
| status | ENUM | ✓ | |
| memo | TEXT | | |
| created_at | TIMESTAMP | ✓ | |

---

#### payments (결제)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| order_id | UUID | ✓ | FK → orders |
| pg_provider | VARCHAR(50) | ✓ | toss, kakao, callgate_visible 등 |
| pg_txn_id | VARCHAR(100) | | PG 거래 ID |
| amount | DECIMAL(12,2) | ✓ | |
| status | ENUM | ✓ | pending, completed, failed, refunded |
| paid_at | TIMESTAMP | | |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

### 3.5 장바구니·관심상품·최근 본 상품·배송지

#### carts (장바구니)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| user_id | UUID | | FK → users. 비회원 시 null |
| session_id | VARCHAR(100) | | 비회원용 세션 ID |
| client_id | UUID | ✓ | FK → clients (출처) |
| created_at, updated_at | TIMESTAMP | ✓ | |

**제약:** (user_id, client_id) 또는 (session_id, client_id) UK

---

#### cart_items (장바구니 상품)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| cart_id | UUID | ✓ | FK → carts |
| product_id | UUID | ✓ | FK → products |
| option_json | JSONB | | 선택 옵션 |
| quantity | INT | ✓ | |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

#### wishlist_items (관심상품)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| user_id | UUID | ✓ | FK → users |
| product_id | UUID | ✓ | FK → products |
| client_id | UUID | ✓ | FK → clients (출처 거래처) |
| created_at, updated_at | TIMESTAMP | ✓ | |

**비즈니스 규칙:** 사용자·거래처·상품 조합 UK. 사이드바 Wish list 클릭 시 /wishlist 페이지 이동.

---

#### product_views (최근 본 상품)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| user_id | UUID | ✓ | FK → users |
| product_id | UUID | ✓ | FK → products |
| client_id | UUID | ✓ | FK → clients (출처 거래처) |
| viewed_at | TIMESTAMP | ✓ | 최근 조회 시각 (정렬·갱신용) |
| created_at, updated_at | TIMESTAMP | ✓ | |

**비즈니스 규칙:** (user_id, product_id, client_id) UK. PDP 진입 시 upsert(해당 행 있으면 viewed_at만 갱신). 목록은 viewed_at DESC 정렬, 페이지네이션. 상품 클릭 시 PDP로 이동, 삭제/장바구니담기/주문하기 액션 제공.

---

#### addresses (배송지)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| user_id | UUID | ✓ | FK → users |
| name | VARCHAR(50) | ✓ | |
| phone | VARCHAR(20) | ✓ | |
| postcode | VARCHAR(10) | ✓ | |
| address | VARCHAR(255) | ✓ | |
| detail | VARCHAR(100) | | |
| is_default | BOOLEAN | ✓ | default false |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

### 3.6 리뷰·공지

#### reviews (리뷰)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| product_id | UUID | ✓ | FK → products |
| order_id | UUID | | FK → orders |
| user_id | UUID | ✓ | FK → users |
| rating | INT | ✓ | 1~5 |
| content | TEXT | | |
| is_blind | BOOLEAN | ✓ | default false |
| admin_reply | TEXT | | |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

#### notices (공지사항)

| 컬럼 | 타입 | 필수 | 설명 |
|------|------|------|------|
| id | UUID | ✓ | PK |
| partner_id | UUID | ✓ | FK → partners |
| client_id | UUID | | FK → clients. null이면 전체 공지 |
| title | VARCHAR(200) | ✓ | |
| content | TEXT | | |
| is_pinned | BOOLEAN | ✓ | default false |
| created_at, updated_at | TIMESTAMP | ✓ | |

---

## 4. ENUM 정의

| ENUM | 값 |
|------|-----|
| verification_status | pending, verified, rejected |
| product.status | active, sold_out, draft |
| order.status | received, confirmed, shipping, delivered, confirmed_purchase, cancelled, returned |
| order_channel | link, phone |
| payment_status | pending, paid, failed, refunded |
| payment.status | pending, completed, failed, refunded |
| user.role | partner_admin, client_staff, end_customer |

---

## 5. Multi-Tenancy 및 인덱스 정책

### 5.1 테넌트 격리

- 모든 파트너 소유 데이터는 `partner_id` 필수
- 쿼리 시 `WHERE partner_id = ?` 조건 필수
- RLS(Row Level Security) 적용 권장

### 5.2 주문 출처 추적

- `orders.client_id` 필수 (nullable 아님)
- 접속 시 `client_source_id`(clients.id)를 세션/쿠키에 저장 후 주문 생성 시 사용

### 5.3 권장 인덱스

| 테이블 | 인덱스 | 용도 |
|--------|--------|------|
| partners | subdomain (UK) | URL 라우팅 |
| clients | (partner_id, slug) UK | URL 라우팅, Slug 중복 방지 |
| orders | (partner_id, created_at DESC) | 주문 목록 |
| orders | (client_id, created_at DESC) | 거래처별 주문 |
| products | (partner_id, status) | 상품 목록 |
| user_clients | user_id (UK) | 1:1 거래처 매핑 |
| client_call_070_configs | client_id (UK) | 거래처당 070 설정 1건 |
| product_views | (user_id, product_id, client_id) UK | 동일 상품 재조회 시 upsert |
| product_views | (user_id, client_id, viewed_at DESC) | 최근 본 상품 목록 조회 |

---

## 6. ERD 시각화 (테이블 관계 요약)

```
partners ──┬── clients ──┬── user_clients ── users
           │             └── client_call_070_configs (070 연동)
           ├── products ── product_categories (M:N)
           │      ├── product_options
           │      ├── product_images
           │      └── product_inventory
           ├── banners
           ├── notices
           ├── partner_admins ── users
           └── orders ── order_items ── products
                  ├── order_status_history
                  ├── payments
                  └── client_id (clients)
                        user_id (users, nullable)

carts ── cart_items ── products
  ├── user_id (users, nullable)
  └── client_id (clients)

wishlist_items ── users, products, clients
product_views ── users, products, clients

addresses ── users
reviews ── products, orders, users
```

---

## 변경 이력

| 날짜 | 시간 | 변경 내용 |
|------|------|-----------|
| 2025-02-06 | 16:00 | product_inventory 비즈니스 규칙: 주문 완료 시 재고 차감, quantity=0→sold_out, Safety Stock 알림 |
| 2025-02-06 | 17:30 | wishlist_items 테이블 추가, user_clients.role(member/admin) 추가 (거래처 관리자 구분) |
| 2025-02-06 | 18:00 | user_clients.role: admin 제외, member만 사용. 거래처 담당자 Admin 불필요 |
| 2025-02-06 | 19:00 | product_views 테이블 추가 (최근 본 상품) |
| 2025-02-06 | 20:00 | 도메인 루트·파트너 전용 URL·localhost 규칙은 PRD, TRD, IMPLEMENTATION_PLAN, PAGE_STRUCTURE_FLOW에 반영 |
| 2026-02-09 | 14:27 | 문서 일시 업데이트 |
| 2026-02-09 | 15:32 | 문서 일시 업데이트 (한국 현지 시간 KST 반영) |
| 2026-02-09 | - | client_call_070_configs 테이블 추가: 전용 URL·070번호 매칭, CallCloud 신규 고객사 등록 입력 정보 저장 |

---

*본 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
