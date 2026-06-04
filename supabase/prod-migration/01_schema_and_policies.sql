-- =============================================================================
-- CallLink ShoppingMaster — Schema (from supabase/migrations/*.sql.txt)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- migration: 20260210000001_enums_and_core_tables.sql.txt ----------
-- Call-Link Shopping Mall: ENUMs and core tables (partners, users, clients, partner_admins, user_clients, client_call_070_configs)
-- ERD v1.0, IMPLEMENTATION_PLAN Phase 0 T0-2

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE user_role AS ENUM ('partner_admin', 'client_staff', 'end_customer');
CREATE TYPE user_client_role AS ENUM ('member', 'admin');
CREATE TYPE product_status AS ENUM ('active', 'sold_out', 'draft');
CREATE TYPE order_status AS ENUM (
  'received', 'confirmed', 'shipping', 'delivered',
  'confirmed_purchase', 'cancelled', 'returned'
);
CREATE TYPE order_channel AS ENUM ('link', 'phone');
CREATE TYPE order_payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subdomain VARCHAR(50) NOT NULL UNIQUE,
  business_registration_number VARCHAR(12) NOT NULL UNIQUE,
  company_name VARCHAR(100) NOT NULL,
  representative VARCHAR(50) NOT NULL,
  postcode VARCHAR(10),
  address VARCHAR(255) NOT NULL,
  business_type VARCHAR(50),
  contact VARCHAR(20),
  fax VARCHAR(20),
  business_category VARCHAR(50),
  email VARCHAR(100) NOT NULL,
  trade_categories JSONB,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_partners_subdomain ON partners (subdomain);
CREATE UNIQUE INDEX idx_partners_business_registration_number ON partners (business_registration_number);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(50),
  phone VARCHAR(20),
  role user_role NOT NULL DEFAULT 'end_customer',
  provider VARCHAR(20),
  provider_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_provider_provider_id UNIQUE (provider, provider_id)
);
CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  slug VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  logo_url VARCHAR(500),
  business_registration_number VARCHAR(12),
  verification_status verification_status NOT NULL DEFAULT 'pending',
  contact_name VARCHAR(50),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  call_070_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_clients_partner_slug UNIQUE (partner_id, slug)
);
CREATE INDEX idx_clients_partner_id ON clients (partner_id);

CREATE TABLE partner_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_partner_admins_user_partner UNIQUE (user_id, partner_id)
);
CREATE INDEX idx_partner_admins_partner_id ON partner_admins (partner_id);
CREATE INDEX idx_partner_admins_user_id ON partner_admins (user_id);

CREATE TABLE user_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  role user_client_role DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_user_clients_user_id ON user_clients (user_id);
CREATE INDEX idx_user_clients_client_id ON user_clients (client_id);

CREATE TABLE client_call_070_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL UNIQUE REFERENCES clients (id) ON DELETE CASCADE,
  call_070_number VARCHAR(20) NOT NULL,
  greeting_message VARCHAR(500),
  industry VARCHAR(50),
  admin_name VARCHAR(50),
  admin_email VARCHAR(100),
  admin_phone VARCHAR(20),
  sms_text_template TEXT,
  callcloud_registered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_client_call_070_configs_client_id ON client_call_070_configs (client_id);

-- ---------- migration: 20260210000002_products_and_categories.sql.txt ----------
-- Products, categories, options, images, banners, notices (ERD)

CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  parent_id UUID REFERENCES product_categories (id) ON DELETE SET NULL,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_categories_partner_id ON product_categories (partner_id);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  short_description VARCHAR(500) NOT NULL,
  description_html TEXT,
  thumbnail_url VARCHAR(500),
  base_price DECIMAL(12,2),
  sale_price DECIMAL(12,2) NOT NULL,
  stock_qty INT NOT NULL DEFAULT 0,
  safety_stock INT NOT NULL DEFAULT 10,
  status product_status NOT NULL DEFAULT 'active',
  sticker_options JSONB,
  delivery_methods JSONB NOT NULL,
  allow_delivery_date BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_products_partner_slug UNIQUE (partner_id, slug)
);
CREATE INDEX idx_products_partner_id ON products (partner_id);
CREATE INDEX idx_products_partner_status ON products (partner_id, status);

CREATE TABLE product_category_mappings (
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories (id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE product_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  value VARCHAR(100) NOT NULL,
  price_adjustment DECIMAL(12,2) DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_options_product_id ON product_options (product_id);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_images_product_id ON product_images (product_id);

CREATE TABLE product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL UNIQUE REFERENCES products (id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  safety_stock INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  image_url VARCHAR(500) NOT NULL,
  link_url VARCHAR(500),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_banners_partner_id ON banners (partner_id);

CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients (id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notices_partner_id ON notices (partner_id);

-- ---------- migration: 20260210000003_orders_carts_wishlist_reviews.sql.txt ----------
-- Orders, order_items, payments, carts, wishlist, product_views, addresses, reviews (ERD)

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  order_no VARCHAR(20) NOT NULL UNIQUE,
  status order_status NOT NULL DEFAULT 'received',
  order_channel order_channel NOT NULL DEFAULT 'link',
  total_amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_status order_payment_status NOT NULL DEFAULT 'pending',
  shipping_name VARCHAR(50) NOT NULL,
  shipping_phone VARCHAR(20) NOT NULL,
  shipping_postcode VARCHAR(10) NOT NULL,
  shipping_address VARCHAR(255) NOT NULL,
  shipping_detail VARCHAR(100),
  tracking_number VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_orders_order_no ON orders (order_no);
CREATE INDEX idx_orders_partner_created ON orders (partner_id, created_at DESC);
CREATE INDEX idx_orders_client_created ON orders (client_id, created_at DESC);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  product_name VARCHAR(200) NOT NULL,
  option_json JSONB,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order_id ON order_items (order_id);

CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  status order_status NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_status_history_order_id ON order_status_history (order_id);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  pg_provider VARCHAR(50) NOT NULL,
  pg_txn_id VARCHAR(100),
  amount DECIMAL(12,2) NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order_id ON payments (order_id);

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  session_id VARCHAR(100),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_carts_user_client ON carts (user_id, client_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_carts_session_client ON carts (session_id, client_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_carts_client_id ON carts (client_id);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  option_json JSONB,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cart_items_cart_id ON cart_items (cart_id);

CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wishlist_user_product_client UNIQUE (user_id, product_id, client_id)
);
CREATE INDEX idx_wishlist_items_user_id ON wishlist_items (user_id);
CREATE INDEX idx_wishlist_items_client_id ON wishlist_items (client_id);

CREATE TABLE product_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_views_user_product_client UNIQUE (user_id, product_id, client_id)
);
CREATE INDEX idx_product_views_user_client_viewed ON product_views (user_id, client_id, viewed_at DESC);

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  postcode VARCHAR(10) NOT NULL,
  address VARCHAR(255) NOT NULL,
  detail VARCHAR(100),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_user_id ON addresses (user_id);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders (id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  is_blind BOOLEAN NOT NULL DEFAULT false,
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_product_id ON reviews (product_id);

-- ---------- migration: 20260211000001_add_partner_columns.sql.txt ----------
-- =====================================================
-- Migration: Add new columns to partners table
-- Date: 2026-02-11
-- Purpose: 파트너 등록 폼 UI 개선에 따른 신규 컬럼 추가
-- =====================================================

-- 1. 가맹점명 (Franchise Name) 추가
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS franchise_name VARCHAR(100);

-- 2. 법인등록번호 (Corporate Registration Number) 추가
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS corporate_registration_number VARCHAR(15);

-- 3. 대표자 생년월일 (Representative Date of Birth) 추가
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS representative_dob DATE;

-- 4. Owner ID 추가 (파트너 생성자의 user_id)
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

-- 5. 컬럼 코멘트 추가 (문서화)
COMMENT ON COLUMN partners.franchise_name IS '가맹점명';
COMMENT ON COLUMN partners.corporate_registration_number IS '법인등록번호 (13자리)';
COMMENT ON COLUMN partners.representative_dob IS '대표자 생년월일';
COMMENT ON COLUMN partners.owner_id IS '파트너 생성자 (users 테이블 FK)';

-- 6. 기존 컬럼 코멘트 추가 (명확성)
COMMENT ON COLUMN partners.business_registration_number IS '사업자등록번호 (10자리)';
COMMENT ON COLUMN partners.company_name IS '사업자명 (법인명)';
COMMENT ON COLUMN partners.representative IS '대표자명';
COMMENT ON COLUMN partners.email IS '대표자 이메일';
COMMENT ON COLUMN partners.contact IS '대표자 연락처';
COMMENT ON COLUMN partners.business_type IS '업태 (예: 도소매업)';
COMMENT ON COLUMN partners.business_category IS '업종 (예: 외식업)';

-- 7. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_partners_franchise_name ON partners (franchise_name) WHERE franchise_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_corporate_registration_number ON partners (corporate_registration_number) WHERE corporate_registration_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_owner_id ON partners (owner_id);

-- ---------- migration: 20260211000002_organize_client_tables.sql.txt ----------
-- =====================================================
-- Migration: 거래처(Client) 관련 테이블 정리
-- Date: 2026-02-11
-- Purpose: 테이블/컬럼 코멘트 추가 및 조회용 인덱스 보강
-- =====================================================

-- 1. clients (거래처 마스터)
COMMENT ON TABLE public.clients IS '파트너 소속 거래처. 쇼핑몰별 고객사(가맹점) 정보. partner_id + slug로 고유.';
COMMENT ON COLUMN public.clients.id IS 'PK';
COMMENT ON COLUMN public.clients.partner_id IS '소속 파트너(본사) FK';
COMMENT ON COLUMN public.clients.slug IS 'URL용 식별자. 파트너 내 유일 (예: abc-shop)';
COMMENT ON COLUMN public.clients.name IS '거래처명';
COMMENT ON COLUMN public.clients.logo_url IS 'CI/로고 이미지 URL';
COMMENT ON COLUMN public.clients.business_registration_number IS '사업자등록번호';
COMMENT ON COLUMN public.clients.verification_status IS '심사 상태: pending(심사중), verified(정상), rejected(중지)';
COMMENT ON COLUMN public.clients.contact_name IS '담당자명';
COMMENT ON COLUMN public.clients.contact_phone IS '담당자 연락처';
COMMENT ON COLUMN public.clients.contact_email IS '담당자 이메일';
COMMENT ON COLUMN public.clients.call_070_connected IS '070 번호 연동 여부';
COMMENT ON COLUMN public.clients.created_at IS '등록일시';
COMMENT ON COLUMN public.clients.updated_at IS '수정일시';

CREATE INDEX IF NOT EXISTS idx_clients_partner_created_at ON public.clients (partner_id, created_at DESC);

-- 2. user_clients (사용자-거래처 매핑)
COMMENT ON TABLE public.user_clients IS '사용자와 거래처 1:1 매핑. client_staff가 소속 거래처 정보.';
COMMENT ON COLUMN public.user_clients.user_id IS '사용자 PK (1:1)';
COMMENT ON COLUMN public.user_clients.client_id IS '소속 거래처 FK';
COMMENT ON COLUMN public.user_clients.role IS '역할: member, admin';
COMMENT ON COLUMN public.user_clients.status IS '승인 상태: PENDING, APPROVED';
COMMENT ON COLUMN public.user_clients.created_at IS '매핑 생성일시';
COMMENT ON COLUMN public.user_clients.updated_at IS '수정일시';

CREATE INDEX IF NOT EXISTS idx_user_clients_client_id ON public.user_clients (client_id);

-- 3. client_call_070_configs (070 연동 설정)
COMMENT ON TABLE public.client_call_070_configs IS '거래처별 070 인입 번호 및 CallCloud 연동 설정. 거래처당 1건.';
COMMENT ON COLUMN public.client_call_070_configs.id IS 'PK';
COMMENT ON COLUMN public.client_call_070_configs.client_id IS '거래처 FK (UNIQUE)';
COMMENT ON COLUMN public.client_call_070_configs.call_070_number IS '070 인입 번호';
COMMENT ON COLUMN public.client_call_070_configs.greeting_message IS '인사 메시지';
COMMENT ON COLUMN public.client_call_070_configs.industry IS '업종';
COMMENT ON COLUMN public.client_call_070_configs.admin_name IS '관리자명';
COMMENT ON COLUMN public.client_call_070_configs.admin_email IS '관리자 이메일';
COMMENT ON COLUMN public.client_call_070_configs.admin_phone IS '관리자 연락처';
COMMENT ON COLUMN public.client_call_070_configs.sms_text_template IS 'SMS 발송 템플릿';
COMMENT ON COLUMN public.client_call_070_configs.callcloud_registered IS 'CallCloud 등록 여부';
COMMENT ON COLUMN public.client_call_070_configs.created_at IS '등록일시';
COMMENT ON COLUMN public.client_call_070_configs.updated_at IS '수정일시';

-- ---------- migration: 20260331000001_guest_checkout_member_price.sql.txt ----------
-- Phase A: 회원/비회원 차등가 + 비회원 주문 식별
-- products.sale_price = 비회원 판매가 (기존 유지)
-- products.member_price = 회원 전용가 (NULL이면 sale_price와 동일 적용)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS member_price DECIMAL(12,2) NULL;

COMMENT ON COLUMN products.member_price IS '회원 전용 판매가. NULL이면 sale_price(비회원가)와 동일';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_checkout_token UUID NULL,
  ADD COLUMN IF NOT EXISTS guest_password_hash TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_guest_checkout_token ON orders (guest_checkout_token) WHERE guest_checkout_token IS NOT NULL;

COMMENT ON COLUMN orders.guest_password_hash IS '주문 조회용 비밀번호 (scrypt 해시)';
COMMENT ON COLUMN orders.is_guest IS '비회원 주문 여부';

-- ---------- migration: 20260331000002_orders_shipping_detail_text.sql.txt ----------
-- 리본·장소 안내 등 긴 비회원 주문 메모를 저장하기 위해 shipping_detail 확장
ALTER TABLE orders
  ALTER COLUMN shipping_detail TYPE TEXT;

-- ---------- migration: 20260331100001_newrun_callback_results.sql.txt ----------
-- 뉴런(Newrun) 협회 member_ext var_ret 콜백 수신 로그 (Phase 2)
-- Service Role API에서만 INSERT (RLS 없음 — 서버 전용 테이블)

CREATE TABLE newrun_callback_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL CHECK (kind IN ('florist', 'product', 'option')),
  method TEXT NOT NULL DEFAULT 'GET',
  raw_query JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_newrun_callback_results_created_at ON newrun_callback_results (created_at DESC);
CREATE INDEX idx_newrun_callback_results_kind ON newrun_callback_results (kind);

COMMENT ON TABLE newrun_callback_results IS '뉴런 연동: 수주화원/상품/옵션 검색 var_ret 콜백 페이로드 (원문 보관)';

-- anon/authenticated 는 정책 없음 → 접근 불가. INSERT 는 Service Role(API 서버)만 사용.
ALTER TABLE newrun_callback_results ENABLE ROW LEVEL SECURITY;

-- ---------- migration: 20260331120000_orders_newrun_drafts.sql.txt ----------
-- T3.3: 뉴런(Newrun) 협회 검색 var_ret 선택값 — 주문별 발주 초안 (Phase 4 매핑 입력)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS newrun_florist_draft JSONB,
  ADD COLUMN IF NOT EXISTS newrun_product_draft JSONB,
  ADD COLUMN IF NOT EXISTS newrun_option_draft JSONB;

COMMENT ON COLUMN orders.newrun_florist_draft IS '뉴런 연동: 수주화원 검색 콜백 페이로드 (협회 파라미터 원문)';
COMMENT ON COLUMN orders.newrun_product_draft IS '뉴런 연동: 상품 검색 콜백 페이로드';
COMMENT ON COLUMN orders.newrun_option_draft IS '뉴런 연동: 옵션 검색 콜백 페이로드';

-- ---------- migration: 20260331130000_newrun_default_drafts.sql.txt ----------
-- T3.4: 거래처·상품별 뉴런 발주 기본 초안 (주문 draft 없을 때 폴백)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS newrun_default_florist_draft JSONB;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS newrun_default_product_draft JSONB,
  ADD COLUMN IF NOT EXISTS newrun_default_option_draft JSONB;

COMMENT ON COLUMN clients.newrun_default_florist_draft IS '뉴런 연동: 거래처 단위 기본 수주화원 var_ret 페이로드 (주문 newrun_florist_draft가 비어 있을 때 병합)';
COMMENT ON COLUMN products.newrun_default_product_draft IS '뉴런 연동: 상품 단위 기본 상품 검색 페이로드';
COMMENT ON COLUMN products.newrun_default_option_draft IS '뉴런 연동: 상품 단위 기본 옵션 검색 페이로드';

-- ---------- migration: 20260415120000_orders_newrun_submit.sql.txt ----------
-- Phase 5: 뉴런 intranet_post 발주 결과 (자동·수동)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS newrun_submit_status TEXT,
  ADD COLUMN IF NOT EXISTS newrun_rwr_result TEXT,
  ADD COLUMN IF NOT EXISTS newrun_rwr_orderkey TEXT,
  ADD COLUMN IF NOT EXISTS newrun_last_submit_error TEXT,
  ADD COLUMN IF NOT EXISTS newrun_last_submit_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.newrun_submit_status IS '뉴런 발주: success | failed | skipped | duplicate (코드20 등)';
COMMENT ON COLUMN orders.newrun_rwr_result IS 'intranet_post 응답 rwr_result (문자열)';
COMMENT ON COLUMN orders.newrun_rwr_orderkey IS 'intranet_post 응답 rwr_orderkey 등';
COMMENT ON COLUMN orders.newrun_last_submit_error IS '검증 실패·HTTP 오류·파싱 실패 메시지';
COMMENT ON COLUMN orders.newrun_last_submit_at IS '마지막 발주 시도 시각';

-- ---------- migration: 20260420120000_orders_newrun_delivery_info.sql.txt ----------
-- Phase 7: 뉴런 배송상태 콜백(2.6) — 인수·이미지 등 구조화 저장
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS newrun_delivery_info JSONB DEFAULT NULL;

COMMENT ON COLUMN orders.newrun_delivery_info IS '뉴런 배송 콜백: dica(이미지), insuname, insurel, 수령시각, ordercode, state 등';

-- ---------- migration: 20260423103000_orders_orderer_viewpay_merchant_no.sql.txt ----------
-- 비회원 주문자 표시 + ViewPay 가맹점 주문번호(결제 조회·동기화용)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS orderer_name VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS guest_orderer_email VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS viewpay_merchant_order_no VARCHAR(80) NULL;

COMMENT ON COLUMN orders.orderer_name IS '주문서에 입력한 주문자 이름 (비회원·회원 공통 저장 가능)';
COMMENT ON COLUMN orders.guest_orderer_email IS '비회원 결제 시 입력한 주문자 이메일 (ViewPay buyerEmail과 동일 출처)';
COMMENT ON COLUMN orders.viewpay_merchant_order_no IS 'ViewPay startpay products.orderNo (원주문번호_타임스탬프 접미사). 리다이렉트에 cgTid 없을 때 조회 보조';

CREATE INDEX IF NOT EXISTS idx_orders_viewpay_merchant_order_no ON orders (viewpay_merchant_order_no)
  WHERE viewpay_merchant_order_no IS NOT NULL;

-- ---------- migration: 20260423120000_link_kakao_notifications.sql.txt ----------
-- Link 안내 카카오 알림톡 발송 로그 (파트너 어드민 / GET /api/admin/messages)
-- 프로덕션에 이미 수동 적용한 경우 중복 실행은 IF NOT EXISTS 로 무해.

create table if not exists public.link_kakao_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  requested_by_user_id text,
  tran_id text,
  phone_masked text,
  callback_masked text,
  template_code text,
  msg_byte_length int not null default 0,
  http_status int,
  provider_ok boolean not null default false,
  result_code text,
  cmid text,
  error_message text,
  raw_response jsonb,
  resolved_msg_preview text
);

create index if not exists idx_link_kakao_notifications_partner_created
  on public.link_kakao_notifications (partner_id, created_at desc);
create index if not exists idx_link_kakao_notifications_client_created
  on public.link_kakao_notifications (client_id, created_at desc);

alter table public.link_kakao_notifications enable row level security;

-- ---------- migration: 20260423140000_link_kakao_notifications_batch.sql.txt ----------
-- 대량 발송 그룹(batch_id) 및 수신자 표시명(recipient_name)

alter table public.link_kakao_notifications
  add column if not exists batch_id uuid null,
  add column if not exists recipient_name varchar(200) null;

create index if not exists idx_link_kakao_notifications_partner_batch
  on public.link_kakao_notifications (partner_id, batch_id)
  where batch_id is not null;

-- ---------- migration: 20260424100000_orders_florist_delivery_ribbon.sql.txt ----------
-- 화훼·배달 특화: 희망 배송일시, 배송 메모, 리본 문구 영속화 (Phase 1)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS desired_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_time_slot VARCHAR(80),
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS delivery_request_memo TEXT,
  ADD COLUMN IF NOT EXISTS ribbon_sender VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ribbon_message TEXT;

COMMENT ON COLUMN orders.desired_delivery_date IS '희망 배송(배달)일';
COMMENT ON COLUMN orders.delivery_time_slot IS '희망 배송 시간대';
COMMENT ON COLUMN orders.delivery_method IS '배송 방식 (예: parcel, quick)';
COMMENT ON COLUMN orders.delivery_request_memo IS '배송 요청 메모 (문 앞 등)';
COMMENT ON COLUMN orders.ribbon_sender IS '리본 보내는 분';
COMMENT ON COLUMN orders.ribbon_message IS '리본 문구(경조사어 등)';

CREATE INDEX IF NOT EXISTS idx_orders_partner_desired_delivery
  ON orders (partner_id, desired_delivery_date)
  WHERE desired_delivery_date IS NOT NULL;

-- ---------- migration: 20260431140000_users_profile_terms_password.sql.txt ----------
-- users: 약관·프로필 완료·이메일 로그인용 비밀번호 (phone 컬럼은 코어 마이그레이션에 이미 존재)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_agreed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;

COMMENT ON COLUMN public.users.terms_agreed IS '필수 약관 동의 여부';
COMMENT ON COLUMN public.users.profile_completed IS '추가 가입 폼(휴대폰·약관 등) 완료 여부';
COMMENT ON COLUMN public.users.password_hash IS '이메일(ID)/비밀번호 가입 시 scrypt 해시; 소셜 전용 계정은 NULL';

-- 기존 행은 이미 가입된 것으로 간주 (운영 DB 백필)
UPDATE public.users
SET profile_completed = true,
    terms_agreed = true
WHERE profile_completed = false
  AND terms_agreed = false;

-- ---------- migration: 20260431160000_orders_venue_detail.sql.txt ----------
-- 화훼 배달: 장소 상세(빈소·홀 등) 별도 보관 — 발주 payload detailPlace 매핑용

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS venue_detail TEXT;

COMMENT ON COLUMN orders.venue_detail IS '화훼 배달 장소 상세(테스트·발주용 detailPlace)';

-- ---------- migration: 20260501120000_newrun_callback_incoming_url.sql.txt ----------
-- var_ret 관측: 프록시/런타임 이전 원시 URL·쿼리 보존 (EUC-KR 디코딩 디버깅용)

ALTER TABLE newrun_callback_results
  ADD COLUMN IF NOT EXISTS incoming_request_url TEXT,
  ADD COLUMN IF NOT EXISTS incoming_search_raw TEXT;

COMMENT ON COLUMN newrun_callback_results.incoming_request_url IS '요청 시점 request.url (길이 제한은 앱에서 truncate)';
COMMENT ON COLUMN newrun_callback_results.incoming_search_raw IS '후보 쿼리스트링 조각(앱에서 join·truncate)';

-- ---------- migration: 20260506120000_order_partner_notify_events.sql.txt ----------
-- Phase 1: 파트너 어드민용 주문 알림 이벤트 (결제완료·취소)
-- 서버(Service Role)에서만 INSERT. Phase 2에서 조회·ack·RLS 정책 확장.

CREATE TYPE order_partner_notify_event_kind AS ENUM ('order_paid', 'order_cancelled');

CREATE TABLE order_partner_notify_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  kind order_partner_notify_event_kind NOT NULL,
  source VARCHAR(80),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_order_partner_notify_order_kind UNIQUE (order_id, kind)
);

CREATE INDEX idx_opne_partner_created ON order_partner_notify_events (partner_id, created_at DESC);
CREATE INDEX idx_opne_order_id ON order_partner_notify_events (order_id);

COMMENT ON TABLE order_partner_notify_events IS '파트너 운영자 알림용 이벤트(결제완료 1회·취소 1회/주문).';

-- ---------- migration: 20260506130000_order_partner_notify_acks.sql.txt ----------
-- Phase 2: 운영자별 알림 확인(ack)

CREATE TABLE order_partner_notify_acks (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES order_partner_notify_events (id) ON DELETE CASCADE,
  acked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);

CREATE INDEX idx_opena_user ON order_partner_notify_acks (user_id);
CREATE INDEX idx_opena_event ON order_partner_notify_acks (event_id);

COMMENT ON TABLE order_partner_notify_acks IS '파트너 주문 알림 이벤트별 운영자 확인(다중 운영자 독립).';

-- 미확인 건수 (파트너·사용자 스코프) — 서버에서 rpc 호출
CREATE OR REPLACE FUNCTION count_unread_partner_order_notifications(
  p_partner_id UUID,
  p_user_id UUID
)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM order_partner_notify_events e
  WHERE e.partner_id = p_partner_id
    AND NOT EXISTS (
      SELECT 1
      FROM order_partner_notify_acks a
      WHERE a.event_id = e.id
        AND a.user_id = p_user_id
    );
$$;

-- ---------- migration: 20260506140000_orders_ribbon_message_kind.sql.txt ----------
-- 리본/카드 메시지 구분 (협회 화면과 유사 UX)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ribbon_message_kind VARCHAR(20) NOT NULL DEFAULT 'ribbon',
  ADD COLUMN IF NOT EXISTS ribbon_card_message TEXT;

COMMENT ON COLUMN orders.ribbon_message_kind IS 'ribbon | card | both — 리본/카드/동시';
COMMENT ON COLUMN orders.ribbon_card_message IS '카드 문구 — both 일 때 rw_card(리본은 ribbon_message → rw_kyungjo); card 전용은 ribbon_message만 사용';

-- ---------- migration: 20260515180000_orders_checkout_cart_reserve.sql.txt ----------
-- 결제 완료 전까지 장바구니 유지 + 동일 세션 미결제 재주문 시 주문 중복·재고 이중 차감 방지
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_cart_item_ids UUID[] NULL,
  ADD COLUMN IF NOT EXISTS guest_cart_session_id VARCHAR(100) NULL;

COMMENT ON COLUMN orders.checkout_cart_item_ids IS '주문 생성 시 예약한 cart_items.id; ViewPay 결제 완료 확정 시에만 삭제';
COMMENT ON COLUMN orders.guest_cart_session_id IS '비회원 장바구니 carts.session_id; 미결제 재시도 시 기존 주문 재사용 키';

CREATE INDEX IF NOT EXISTS idx_orders_guest_pending_session
  ON orders (client_id, guest_cart_session_id)
  WHERE is_guest = TRUE AND payment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_member_pending_cart
  ON orders (client_id, user_id)
  WHERE is_guest = FALSE AND payment_status = 'pending' AND user_id IS NOT NULL;

-- ---------- migration: 20260516103000_count_unread_notify_by_order.sql.txt ----------
-- 사이드바·목록 New: 미확인 '주문' 건수(같은 주문에 이벤트 여러 개여도 1건).
-- 이후 20260516120000 마이그레이션에서 order_paid(결제 완료 통지)만 집계하도록 좁힘.
CREATE OR REPLACE FUNCTION count_unread_partner_order_notifications(
  p_partner_id UUID,
  p_user_id UUID
)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM (
    SELECT DISTINCT e.order_id
    FROM order_partner_notify_events e
    WHERE e.partner_id = p_partner_id
      AND NOT EXISTS (
        SELECT 1
        FROM order_partner_notify_acks a
        WHERE a.event_id = e.id
          AND a.user_id = p_user_id
      )
  ) u;
$$;

-- ---------- migration: 20260516120000_count_unread_notify_order_paid_only.sql.txt ----------
-- 미확인 주문 알림: '결제 완료(order_paid)' 통지만 집계 (사이드바·목록 New = 신규 매출 미확인 건수)
-- 취소(order_cancelled) 알림은 목록 New/건수에 포함하지 않음 — 취소/반품·상태 컬럼으로 확인
CREATE OR REPLACE FUNCTION count_unread_partner_order_notifications(
  p_partner_id UUID,
  p_user_id UUID
)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM (
    SELECT DISTINCT e.order_id
    FROM order_partner_notify_events e
    WHERE e.partner_id = p_partner_id
      AND e.kind = 'order_paid'::order_partner_notify_event_kind
      AND NOT EXISTS (
        SELECT 1
        FROM order_partner_notify_acks a
        WHERE a.event_id = e.id
          AND a.user_id = p_user_id
      )
  ) u;
$$;

-- ---------- migration: 20260518100000_count_unread_notify_exclude_cancelled_orders.sql.txt ----------
-- 미확인 결제 알림: 이미 주문 취소된 건은 사이드바·목록 New 집계에서 제외
CREATE OR REPLACE FUNCTION count_unread_partner_order_notifications(
  p_partner_id UUID,
  p_user_id UUID
)
RETURNS BIGINT
LANGUAGE SQL
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM (
    SELECT DISTINCT e.order_id
    FROM order_partner_notify_events e
    INNER JOIN orders o
      ON o.id = e.order_id
      AND o.partner_id = e.partner_id
    WHERE e.partner_id = p_partner_id
      AND e.kind = 'order_paid'::order_partner_notify_event_kind
      AND o.status IS DISTINCT FROM 'cancelled'
      AND NOT EXISTS (
        SELECT 1
        FROM order_partner_notify_acks a
        WHERE a.event_id = e.id
          AND a.user_id = p_user_id
      )
  ) u;
$$;

-- ---------- migration: 20260518103000_info_templates_product_policy.sql.txt ----------
-- Phase 1: SaaS형 공통 안내 템플릿(info_templates) + 상품 정책 소스(products.policy_source 등)
-- PDP 탭2: delivery_info / refund_policy / product_notice 3분할 + 카테고리 상속 / 상품 오버라이드

DO $$
BEGIN
  CREATE TYPE product_policy_source AS ENUM ('category_default', 'template', 'custom');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS info_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  delivery_info TEXT NOT NULL DEFAULT '',
  refund_policy TEXT NOT NULL DEFAULT '',
  product_notice TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_info_templates_partner_id ON info_templates (partner_id);
CREATE INDEX IF NOT EXISTS idx_info_templates_partner_name ON info_templates (partner_id, name);

COMMENT ON TABLE info_templates IS '쇼핑몰 공통 안내 템플릿(배송/환불/상품고시). 카테고리 기본값 또는 상품 단위 오버라이드';
COMMENT ON COLUMN info_templates.delivery_info IS '배송 안내 (textarea/HTML 허용, PDP에서 섹션으로 렌더)';
COMMENT ON COLUMN info_templates.refund_policy IS '취소·환불 안내';
COMMENT ON COLUMN info_templates.product_notice IS '상품 고시·유의사항';

ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS default_template_id UUID REFERENCES info_templates (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_categories_default_template ON product_categories (default_template_id)
  WHERE default_template_id IS NOT NULL;

COMMENT ON COLUMN product_categories.default_template_id IS '해당 카테고리 기본 정책 템플릿(미지정 시 상위 해석으로 폴백 없음—상품 resolve에서 다른 매핑 시도)';

ALTER TABLE product_category_mappings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE product_category_mappings
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN product_category_mappings.is_primary IS '다중 카테고리 시 템플릿 우선순위 보조(깊이 동률 등)';
COMMENT ON COLUMN product_category_mappings.created_at IS '매핑 생성 시각—우선순위 보조';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS policy_source product_policy_source NOT NULL DEFAULT 'category_default';
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS override_template_id UUID REFERENCES info_templates (id) ON DELETE SET NULL;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS custom_policy_data JSONB;

COMMENT ON COLUMN products.policy_source IS 'category_default: 카테고리 템플릿 상속 | template: override_template_id | custom: custom_policy_data';
COMMENT ON COLUMN products.override_template_id IS 'policy_source=template 일 때 사용할 info_templates.id';
COMMENT ON COLUMN products.custom_policy_data IS 'policy_source=custom 일 때 { delivery_info, refund_policy, product_notice } JSON';

CREATE INDEX IF NOT EXISTS idx_products_override_template ON products (override_template_id)
  WHERE override_template_id IS NOT NULL;

-- ---------- migration: 20260527120000_link_kakao_delivery_report.sql.txt ----------
-- link_kakao_notifications: 벤더 최종 리포트(카카오/문자 대체) 저장 컬럼
-- 기존 result_code, provider_ok, raw_response = 접수(발송 API) 결과 유지

alter table public.link_kakao_notifications
  add column if not exists delivery_status text not null default 'pending';

alter table public.link_kakao_notifications
  add column if not exists report_synced_at timestamptz;

alter table public.link_kakao_notifications
  add column if not exists kakao_report_code text;

alter table public.link_kakao_notifications
  add column if not exists kakao_report_message text;

alter table public.link_kakao_notifications
  add column if not exists kakao_report_success boolean;

alter table public.link_kakao_notifications
  add column if not exists sms_report_code text;

alter table public.link_kakao_notifications
  add column if not exists sms_report_message text;

alter table public.link_kakao_notifications
  add column if not exists sms_report_success boolean;

alter table public.link_kakao_notifications
  add column if not exists final_error_message text;

alter table public.link_kakao_notifications
  add column if not exists report_raw_response jsonb;

-- 기존 데이터: 접수 실패는 failed, 접수 성공(레거시)은 당시 기준 최종 성공으로 간주
update public.link_kakao_notifications
set delivery_status = case
  when provider_ok = false then 'failed'
  when provider_ok = true and cmid is not null then 'success'
  when provider_ok = true then 'pending'
  else 'failed'
end
where delivery_status = 'pending'
  and report_synced_at is null
  and kakao_report_code is null;

create index if not exists idx_link_kakao_notifications_partner_delivery_pending
  on public.link_kakao_notifications (partner_id, created_at desc)
  where delivery_status = 'pending' and provider_ok = true and cmid is not null;

-- ---------- migration: 20260528100000_storage_buckets_image_upload.sql.txt ----------
-- 이미지 업로드 API (/api/upload/image)용 Storage 버킷
-- Supabase Dashboard에서 수동 생성한 경우에도 id가 코드(BUCKETS)와 일치해야 함.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('products', 'products', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('clients', 'clients', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('banners', 'banners', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('Partners', 'Partners', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 공개 버킷 객체 읽기 (쇼핑몰·어드민 미리보기)
DROP POLICY IF EXISTS "storage_public_read_products" ON storage.objects;
CREATE POLICY "storage_public_read_products"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "storage_public_read_clients" ON storage.objects;
CREATE POLICY "storage_public_read_clients"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'clients');

DROP POLICY IF EXISTS "storage_public_read_banners" ON storage.objects;
CREATE POLICY "storage_public_read_banners"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "storage_public_read_partners" ON storage.objects;
CREATE POLICY "storage_public_read_partners"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'Partners');


-- [SKIP] DATABASE_URL 미설정 — RLS/Policy/Function/Trigger live dump 생략
-- Supabase Dashboard → Database → Connection string 을 .env.local DATABASE_URL 에 추가 후 재실행
