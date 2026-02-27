-- CallLink ShoppingMaster 전체 스키마 (ERD v1.0 + Decision Log 반영)
-- products.stock_qty 통합 (product_inventory 후순위)
-- 장바구니 세션 병합, 카테고리, 주문·결제·배송지·관심상품·최근본상품·공지·리뷰 포함

-- ============================================================
-- ENUM 타입 (text + check로 대체, 확장 용이)
-- ============================================================

-- ============================================================
-- 1. users (회원) - auth.users 확장
-- ※ auth.users INSERT 시 public.users 자동 생성은 트리거 또는 NextAuth 콜백에서 처리
-- ============================================================
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  name text,
  phone text,
  role text default 'end_customer' check (role in ('partner_admin', 'client_admin', 'client_staff', 'end_customer')),
  provider text,
  provider_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index users_email_uk on public.users(email) where email is not null;

-- ============================================================
-- 2. partners (파트너사)
-- ============================================================
create table public.partners (
  id uuid default gen_random_uuid() primary key,
  subdomain text unique not null,
  business_registration_number text unique,
  company_name text not null,
  representative text not null,
  postcode text,
  address text not null,
  business_type text,
  contact text,
  fax text,
  business_category text,
  email text not null,
  trade_categories jsonb,
  verification_status text default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  verified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 3. partner_admins (파트너 관리자)
-- ============================================================
create table public.partner_admins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  partner_id uuid references public.partners(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, partner_id)
);

-- ============================================================
-- 4. clients (거래처)
-- ============================================================
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid references public.partners(id) on delete cascade not null,
  slug text not null,
  name text not null,
  logo_url text,
  business_registration_number text,
  verification_status text default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  contact_name text,
  contact_phone text,
  contact_email text,
  call_070_connected boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(partner_id, slug)
);

-- ============================================================
-- 5. client_call_070_configs (070 연동 설정)
-- ============================================================
create table public.client_call_070_configs (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null unique,
  call_070_number text,
  greeting_message text,
  industry text,
  admin_name text,
  admin_email text,
  admin_phone text,
  sms_text_template text,
  callcloud_registered boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 6. user_clients (거래처 직원 매핑) - 1:1 (user당 1거래처)
-- ============================================================
create table public.user_clients (
  user_id uuid references public.users(id) on delete cascade not null primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  role text default 'member' check (role in ('member', 'admin')),
  status text default 'APPROVED' check (status in ('PENDING', 'APPROVED')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 7. product_categories (상품 카테고리)
-- ============================================================
create table public.product_categories (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid references public.partners(id) on delete cascade not null,
  parent_id uuid references public.product_categories(id) on delete set null,
  name text not null,
  slug text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 8. products (상품) - stock_qty 통합 [Decision Log]
-- ============================================================
create table public.products (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid references public.partners(id) on delete cascade not null,
  name text not null,
  slug text not null,
  short_description text,
  description_html text,
  thumbnail_url text,
  base_price numeric(12,2),
  sale_price numeric(12,2) not null,
  stock_qty int default 0,
  safety_stock int default 10,
  status text default 'active' check (status in ('active', 'sold_out', 'draft')),
  sticker_options jsonb,
  delivery_methods jsonb not null,
  allow_delivery_date boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(partner_id, slug)
);

-- ============================================================
-- 9. product_category_mappings (상품-카테고리 N:N)
-- ============================================================
create table public.product_category_mappings (
  product_id uuid references public.products(id) on delete cascade not null,
  category_id uuid references public.product_categories(id) on delete cascade not null,
  primary key (product_id, category_id)
);

-- ============================================================
-- 10. product_options (상품 옵션)
-- ============================================================
create table public.product_options (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  name text not null,
  value text not null,
  price_adjustment numeric(12,2) default 0,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 11. product_images (상품 이미지)
-- ============================================================
create table public.product_images (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  url text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 12. banners (배너)
-- ============================================================
create table public.banners (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid references public.partners(id) on delete cascade not null,
  image_url text not null,
  link_url text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 13. orders (주문)
-- ============================================================
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid references public.partners(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete set null,
  order_no text unique not null,
  status text default 'received' check (status in ('received', 'confirmed', 'shipping', 'delivered', 'confirmed_purchase', 'cancelled', 'returned')),
  order_channel text check (order_channel in ('link', 'phone')),
  total_amount numeric(12,2) not null,
  payment_method text,
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  shipping_name text not null,
  shipping_phone text not null,
  shipping_postcode text not null,
  shipping_address text not null,
  shipping_detail text,
  tracking_number text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index orders_partner_created_idx on public.orders(partner_id, created_at desc);
create index orders_client_created_idx on public.orders(client_id, created_at desc);

-- ============================================================
-- 14. order_items (주문 상품)
-- ============================================================
create table public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  option_json jsonb,
  quantity int not null,
  unit_price numeric(12,2) not null,
  total_price numeric(12,2) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 15. order_status_history (주문 상태 이력)
-- ============================================================
create table public.order_status_history (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  status text not null,
  memo text,
  created_at timestamptz default now()
);

-- ============================================================
-- 16. payments (결제)
-- ============================================================
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  pg_provider text not null,
  pg_txn_id text,
  amount numeric(12,2) not null,
  status text check (status in ('pending', 'completed', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 17. carts (장바구니) - user_id nullable, session_id [Cart Policy]
-- ============================================================
create table public.carts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade,
  session_id text,
  client_id uuid references public.clients(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index carts_user_client_uk on public.carts(user_id, client_id) where user_id is not null;
create unique index carts_session_client_uk on public.carts(session_id, client_id) where user_id is null and session_id is not null;

-- ============================================================
-- 18. cart_items (장바구니 상품)
-- ============================================================
create table public.cart_items (
  id uuid default gen_random_uuid() primary key,
  cart_id uuid references public.carts(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  option_json jsonb,
  quantity int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 19. wishlist_items (관심상품)
-- ============================================================
create table public.wishlist_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, product_id, client_id)
);

-- ============================================================
-- 20. product_views (최근 본 상품) - 로그인 필수
-- ============================================================
create table public.product_views (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade not null,
  viewed_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, product_id, client_id)
);
create index product_views_user_client_viewed_idx on public.product_views(user_id, client_id, viewed_at desc);

-- ============================================================
-- 21. addresses (배송지)
-- ============================================================
create table public.addresses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  phone text not null,
  postcode text not null,
  address text not null,
  detail text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 22. notices (공지사항)
-- ============================================================
create table public.notices (
  id uuid default gen_random_uuid() primary key,
  partner_id uuid references public.partners(id) on delete cascade not null,
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  content text,
  is_pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- 23. reviews (리뷰)
-- ============================================================
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid references public.users(id) on delete cascade not null,
  rating int not null check (rating between 1 and 5),
  content text,
  is_blind boolean default false,
  admin_reply text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- RLS 활성화 (선택) - 보안 강화 시 사용
-- ============================================================
-- alter table public.users enable row level security;
-- alter table public.partners enable row level security;
-- ... (필요 시 각 테이블별 정책 추가)
