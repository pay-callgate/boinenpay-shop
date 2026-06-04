-- =============================================================================
-- CallLink ShoppingMaster — 우리부고(Uribugo) 운영 Seed
-- 트랜잭션(orders/carts 등) · 스펙 외 테스트 상품 제외
-- 생성 시각: 2026-06-04T04:39:45.008Z
-- =============================================================================
BEGIN;

-- partners (wooribugo)
INSERT INTO public.partners (id, subdomain, business_registration_number, company_name, representative, postcode, address, business_type, contact, fax, business_category, email, trade_categories, verification_status, verified_at, created_at, updated_at, franchise_name, corporate_registration_number, representative_dob, owner_id, logo_url)
VALUES ('f474a63e-181d-4b1e-a49a-855840ad2484', 'wooribugo', '118-81-23147', '주식회사 제이에스브라더스', '주동규', '08592', '서울 금천구 가산디지털1로 75-15 504호', NULL, '01045447740', NULL, '도매 및 소매업', 'ddd831025@hanmail.net', '', 'verified', '2026-02-12T01:11:33.82+00:00', '2026-02-12T01:11:32.765995+00:00', '2026-05-18T22:55:45.633+00:00', '주식회사 우리부고', NULL, '2026-02-18', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/Partners/f474a63e-181d-4b1e-a49a-855840ad2484/logo/1779144940827-y9ara6.jpg')
ON CONFLICT (id) DO NOTHING;

-- product_categories
INSERT INTO public.product_categories (id, partner_id, parent_id, name, slug, sort_order, created_at, updated_at)
VALUES (
  'ca110001-0000-0000-0000-000000000005',
  'f474a63e-181d-4b1e-a49a-855840ad2484',
  NULL,
  '축하화환',
  'congratulatory wreath',
  2,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.product_categories (id, partner_id, parent_id, name, slug, sort_order, created_at, updated_at)
VALUES (
  'ca110001-0000-0000-0000-000000000006',
  'f474a63e-181d-4b1e-a49a-855840ad2484',
  NULL,
  '근조화환',
  'rhizome wreath',
  3,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- products (neuron spec 22건 + 발주 draft 강제 주입)
INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('8c8e6c14-55cf-4644-a3fd-7e0392fc6af6', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조3단', 'nr-m39', '근조3단 · 근조화환 · Must-have (E2E 테스트용) · rw_menucode=39', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461204112/1778461203751-ryxlrl.jpg', 100000, 100000, 100, 999, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"39","rw_price":"50000","neuron_code":"39","neuron_order_price":"50000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:49.249406+00:00'::timestamptz, '2026-06-04T04:39:43.978Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('bdbc7e6d-8ab2-42b0-971f-d36dc9a70bf0', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하3단', 'nr-m35', '축하3단 · 축하화환 · Must-have (E2E 테스트용) · rw_menucode=35', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461171531/1778461171378-2obo0o.jpg', 100000, 100000, 100, 999, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"35","rw_price":"50000","neuron_code":"35","neuron_order_price":"50000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:49.720462+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('1ce0e121-b4e4-4e16-987b-b0cb445de02e', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조화환(기본형)', 'nr-m09', '근조화환(기본형) · 근조화환 · rw_menucode=09', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461101061/1778461100950-t9cjgt.jpg', 100000, 100000, 100, 999, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"09","rw_price":"50000","neuron_code":"09","neuron_order_price":"50000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:50.169975+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('e43cecab-82f3-4507-a4b4-94eb78d0534d', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하화환(기본형)', 'nr-m08', '축하화환(기본형) · 축하화환 · rw_menucode=08', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461081099/1778461081714-r2abwz.jpg', 100000, 100000, 100, 998, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"08","rw_price":"50000","neuron_code":"08","neuron_order_price":"50000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:50.626555+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('1fce4830-e73f-4826-a3c2-dae1452dc2fb', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조화환(특)', 'nr-m43', '근조화환(특) · 근조화환 · rw_menucode=43', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461146795/1778461146561-birrur.jpg', 120000, 120000, 100, 999, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"43","rw_price":"70000","neuron_code":"43","neuron_order_price":"70000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:51.077344+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('c007642f-30b8-4e19-bd4a-30d80eae6d98', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하화환(특)', 'nr-m44', '축하화환(특) · 축하화환 · rw_menucode=44', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461124141/1778461124049-cqh483.jpg', 120000, 120000, 100, 995, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"44","rw_price":"70000","neuron_code":"44","neuron_order_price":"70000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:51.560553+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('de10e4b9-f0dd-4a0b-9675-172d6989f6a6', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조화환(특대)', 'nr-m45', '근조화환(특대) · 근조화환 · rw_menucode=45', NULL, NULL, 130000, 130000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"45","rw_price":"80000","neuron_code":"45","neuron_order_price":"80000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:52.003981+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('c7b8e8ed-caeb-4dcf-a8c7-20165e991385', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하화환(특대)', 'nr-m46', '축하화환(특대) · 축하화환 · rw_menucode=46', NULL, NULL, 130000, 130000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"46","rw_price":"80000","neuron_code":"46","neuron_order_price":"80000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:52.441277+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('7771e6a1-7e11-4ce3-817b-e7c34cb26565', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조바구니', 'nr-m41', '근조바구니 · 근조화환 · rw_menucode=41', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778224750147/1778224750114-z715mx.jpg', 90000, 90000, 100, 999, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"41","rw_price":"50000","neuron_code":"41","neuron_order_price":"50000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:52.885414+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('d76df1e3-d160-400b-9432-e59678cc51c3', 'f474a63e-181d-4b1e-a49a-855840ad2484', '오브제1단', 'nr-m51', '오브제1단 · 기타 · rw_menucode=51', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778225021539/1778225021497-jv567d.jpg', 120000, 120000, NULL, 988, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"51","rw_price":"60000","neuron_code":"51","neuron_order_price":"60000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:53.660423+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('3a76d67d-847c-45cb-97c3-728a4de201ba', 'f474a63e-181d-4b1e-a49a-855840ad2484', '오브제2단', 'nr-m52', '오브제2단 · 기타 · rw_menucode=52', NULL, NULL, 150000, 150000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"48","rw_price":"80000","neuron_code":"48","neuron_order_price":"80000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:58.176798+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('c74930a8-d235-4cec-84a2-cd7ba25c44f8', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조4단', 'nr-m42', '근조4단 · 근조화환 · rw_menucode=42', NULL, NULL, 150000, 150000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"42","rw_price":"90000","neuron_code":"42","neuron_order_price":"90000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:54.532957+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('f4e1439d-5fac-4de1-8288-e7a4c688abbe', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하4단', 'nr-m37', '축하4단 · 축하화환 · rw_menucode=37', NULL, NULL, 150000, 150000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"37","rw_price":"90000","neuron_code":"37","neuron_order_price":"90000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:54.929566+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('b1e74752-7a01-4a79-966c-32246deb1b49', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조쌀화환10kg', 'nr-m91', '근조쌀화환10kg · 근조화환 · rw_menucode=91', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461283272/1778461283384-mecaly.jpg', 100000, 100000, 100, 963, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"91","rw_price":"80000","neuron_code":"91","neuron_order_price":"80000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:55.314172+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('43dee1cb-320d-4327-994c-afc9c845bb7b', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하쌀화환10kg', 'nr-m92', '축하쌀화환10kg · 축하화환 · rw_menucode=92', NULL, NULL, 100000, 100000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"92","rw_price":"80000","neuron_code":"92","neuron_order_price":"80000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:55.699063+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('cd68b319-e4a6-4eb7-833a-b268f6b2f888', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조쌀화환20KG', 'nr-m93', '근조쌀화환20kg · 근조화환 · rw_menucode=93', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778461307883/1778461308592-llsffn.jpg', 130000, 130000, 100, 995, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"93","rw_price":"100000","neuron_code":"93","neuron_order_price":"100000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:56.100045+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('7b9d9dd4-e742-4778-bc66-035cef7da005', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하쌀화환20kg', 'nr-m94', '축하쌀화환20kg · 축하화환 · rw_menucode=94', NULL, NULL, 130000, 130000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"94","rw_price":"100000","neuron_code":"94","neuron_order_price":"100000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:56.493392+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('2b6dad44-bb86-44de-9b69-a76b1f1eee99', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조5단', 'nr-m49', '근조5단 · 근조화환 · rw_menucode=49', NULL, NULL, 250000, 250000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"49","rw_price":"150000","neuron_code":"49","neuron_order_price":"150000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:56.978861+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('60fa8d44-a304-421b-8543-3ecafcccee47', 'f474a63e-181d-4b1e-a49a-855840ad2484', '축하5단', 'nr-m38', '축하5단 · 축하화환 · rw_menucode=38', NULL, NULL, 250000, 250000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"38","rw_price":"150000","neuron_code":"38","neuron_order_price":"150000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:57.383224+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('d76df1e3-d160-400b-9432-e59678cc51c3', 'f474a63e-181d-4b1e-a49a-855840ad2484', '오브제1단', 'nr-m51', '오브제1단 · 기타 · rw_menucode=51', NULL, 'https://sneelraxnrxylvclopep.supabase.co/storage/v1/object/public/products/f474a63e-181d-4b1e-a49a-855840ad2484/temp-1778225021539/1778225021497-jv567d.jpg', 120000, 120000, NULL, 988, 10, 'active', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"47","rw_price":"60000","neuron_code":"47","neuron_order_price":"60000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:53.660423+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('3a76d67d-847c-45cb-97c3-728a4de201ba', 'f474a63e-181d-4b1e-a49a-855840ad2484', '오브제2단', 'nr-m52', '오브제2단 · 기타 · rw_menucode=52', NULL, NULL, 150000, 150000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"52","rw_price":"80000","neuron_code":"52","neuron_order_price":"80000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:02:58.176798+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.products (id, partner_id, name, slug, short_description, description_html, thumbnail_url, base_price, sale_price, member_price, stock_qty, safety_stock, status, sticker_options, delivery_methods, allow_delivery_date, policy_source, override_template_id, custom_policy_data, newrun_default_product_draft, newrun_default_option_draft, created_at, updated_at)
VALUES ('5ff2cc76-d22d-4ea9-b8ef-82815b4671f8', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조(영정)바구니', 'nr-m89', '근조(영정)바구니 · 근조화환 · rw_menucode=89', NULL, NULL, 90000, 90000, NULL, 999, 10, 'draft', NULL, '["same_day","quick"]'::jsonb, TRUE, 'category_default', NULL, NULL, '{"rw_menucode":"89","rw_price":"50000","neuron_code":"89","neuron_order_price":"50000"}'::jsonb, '{}'::jsonb, '2026-05-08T07:03:03.639954+00:00'::timestamptz, '2026-06-04T04:39:43.986Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sale_price = EXCLUDED.sale_price,
  base_price = EXCLUDED.base_price,
  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,
  updated_at = EXCLUDED.updated_at;

-- product_category_mappings
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('8c8e6c14-55cf-4644-a3fd-7e0392fc6af6', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('bdbc7e6d-8ab2-42b0-971f-d36dc9a70bf0', 'ca110001-0000-0000-0000-000000000005', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('1ce0e121-b4e4-4e16-987b-b0cb445de02e', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('e43cecab-82f3-4507-a4b4-94eb78d0534d', 'ca110001-0000-0000-0000-000000000005', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('1fce4830-e73f-4826-a3c2-dae1452dc2fb', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('c007642f-30b8-4e19-bd4a-30d80eae6d98', 'ca110001-0000-0000-0000-000000000005', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('de10e4b9-f0dd-4a0b-9675-172d6989f6a6', 'ca110001-0000-0000-0000-000000000006', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('c7b8e8ed-caeb-4dcf-a8c7-20165e991385', 'ca110001-0000-0000-0000-000000000005', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('7771e6a1-7e11-4ce3-817b-e7c34cb26565', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('d76df1e3-d160-400b-9432-e59678cc51c3', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('3a76d67d-847c-45cb-97c3-728a4de201ba', 'ca110001-0000-0000-0000-000000000006', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('c74930a8-d235-4cec-84a2-cd7ba25c44f8', 'ca110001-0000-0000-0000-000000000006', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('f4e1439d-5fac-4de1-8288-e7a4c688abbe', 'ca110001-0000-0000-0000-000000000005', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('b1e74752-7a01-4a79-966c-32246deb1b49', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('43dee1cb-320d-4327-994c-afc9c845bb7b', 'ca110001-0000-0000-0000-000000000005', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('cd68b319-e4a6-4eb7-833a-b268f6b2f888', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('7b9d9dd4-e742-4778-bc66-035cef7da005', 'ca110001-0000-0000-0000-000000000005', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('2b6dad44-bb86-44de-9b69-a76b1f1eee99', 'ca110001-0000-0000-0000-000000000006', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('60fa8d44-a304-421b-8543-3ecafcccee47', 'ca110001-0000-0000-0000-000000000005', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('d76df1e3-d160-400b-9432-e59678cc51c3', 'ca110001-0000-0000-0000-000000000006', FALSE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('3a76d67d-847c-45cb-97c3-728a4de201ba', 'ca110001-0000-0000-0000-000000000006', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;
INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES ('5ff2cc76-d22d-4ea9-b8ef-82815b4671f8', 'ca110001-0000-0000-0000-000000000006', TRUE)
ON CONFLICT (product_id, category_id) DO NOTHING;

COMMIT;

-- 검증:
-- SELECT count(*) FROM products WHERE partner_id = 'f474a63e-181d-4b1e-a49a-855840ad2484';