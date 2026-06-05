-- =============================================================================
-- CallLink ShoppingMaster — 우리부고(Uribugo) 거래처·공통 안내 템플릿 Seed
-- 트랜잭션(orders/link_kakao_notifications 등) 제외
-- 생성 시각: 2026-06-05T00:53:52.274Z
-- Storage URL 대상: https://dauzaeogqwxiwfmvhfux.supabase.co
-- 선행: 01_schema → 02_uribugo_seed_data 적용 후 실행
-- =============================================================================
BEGIN;

-- partners (wooribugo) 최신 정보 upsert
INSERT INTO public.partners (id, subdomain, business_registration_number, company_name, representative, postcode, address, business_type, contact, fax, business_category, email, trade_categories, verification_status, verified_at, created_at, updated_at, franchise_name, corporate_registration_number, representative_dob, owner_id, logo_url)
VALUES ('f474a63e-181d-4b1e-a49a-855840ad2484', 'wooribugo', '118-81-23147', '주식회사 제이에스브라더스', '주동규', '08592', '서울 금천구 가산디지털1로 75-15 504호', NULL, '01045447740', NULL, '도매 및 소매업', 'ddd831025@hanmail.net', '[]'::jsonb, 'verified', '2026-02-12T01:11:33.82+00:00', '2026-02-12T01:11:32.765995+00:00', '2026-05-18T22:55:45.633+00:00', '주식회사 우리부고', NULL, '2026-02-18', NULL, 'https://dauzaeogqwxiwfmvhfux.supabase.co/storage/v1/object/public/Partners/f474a63e-181d-4b1e-a49a-855840ad2484/logo/1779144940827-y9ara6.jpg')
ON CONFLICT (id) DO UPDATE SET
  subdomain = EXCLUDED.subdomain,
  business_registration_number = EXCLUDED.business_registration_number,
  company_name = EXCLUDED.company_name,
  representative = EXCLUDED.representative,
  postcode = EXCLUDED.postcode,
  address = EXCLUDED.address,
  business_type = EXCLUDED.business_type,
  contact = EXCLUDED.contact,
  fax = EXCLUDED.fax,
  business_category = EXCLUDED.business_category,
  email = EXCLUDED.email,
  trade_categories = EXCLUDED.trade_categories,
  verification_status = EXCLUDED.verification_status,
  verified_at = EXCLUDED.verified_at,
  updated_at = EXCLUDED.updated_at,
  franchise_name = EXCLUDED.franchise_name,
  corporate_registration_number = EXCLUDED.corporate_registration_number,
  representative_dob = EXCLUDED.representative_dob,
  owner_id = EXCLUDED.owner_id,
  logo_url = EXCLUDED.logo_url;

-- info_templates (공통 안내 관리)
INSERT INTO public.info_templates (id, partner_id, name, delivery_info, refund_policy, product_notice, created_at, updated_at)
VALUES ('1a8560d3-f1b8-409d-a87c-2ede353ed47a', 'f474a63e-181d-4b1e-a49a-855840ad2484', '근조 화환(우리부고용)', '- **기본 배송 시간 (오전 9시 이후 주문 기준)**
  - 평일: 2~4시간 이내 배송
  - 주말 및 공휴일: 3~5시간 이내 배송
  ※ 토/일요일 및 공휴일은 교통 상황에 따라 평일 대비 배송이 다소 지연될 수 있으니 양해 부탁 드립니다.

- **시간대별 배송 마감 안내**
  - 18:00 이전 주문: 당일 배송
  - 18:00 ~ 20:00 주문: 익일 오전 중(12시 이전) 배송
  - 20:00 이후 주문: 익일 14시까지 배송

- **안심 사진 전송:** 배송이 완료되면 주문자님의 휴대폰으로 현장 도착 사진을 전송해 드립니다.

- **고객센터 업무 시간:** 08:30 ~ 19:00', '- **취소 가능 시간:** 주문 후 1시간 이내에만 전액 취소가 가능합니다.

- **취소 접수 방법**
  - 업무 시간 내: 고객센터(1661-5382)로 전화 주시면 즉시 처리됩니다.
  - 업무 시간 외: 010-8755-1897 번호로 [주문자 성함 / 취소 요청] 문자를 남겨주시면 익일 오전에 처리됩니다.

- **환불 불가 및 공제 규정**
  - 생화 상품 특성상 배송이 완료된 후에는 단순 변심으로 인한 취소 및 환불이 절대 불가합니다.
  - 상품 제작이 완료되어 이미 배송이 시작된 경우, 발생한 배송비를 제외한 금액만 환불됩니다.
  - 계절 변화에 따른 포인트 꽃 및 국화 품종 변경은 정상적인 제작 과정이므로 교환 및 환불 사유가 되지 않습니다.

- **환불 처리:** 배송 불가 지역 등의 사유로 환불이 진행될 경우, 요청일 기준 영업일 48시간 이내에 결제 수단(신용카드 승인 취소 또는 계좌 입금)으로 환불 처리됩니다.', '- **제작 방식** : 전국 지역별 화원사의 전문 플로리스트가 맞춤 제작하며, 컴퓨터 붓글씨 폰트로 깔끔하게 인쇄된 리본이 함께 제공됩니다.

- **원산지 안내** : 국내산 및 수입산 생화를 혼합하여 제작하며, 계절 및 수급 상황에 따라 꽃의 원산지나 일부 포인트 꽃이 변경될 수 있습니다.

- **유의 사항** : 전국 화원사 수작업 특성상 지역에 따라 실제 제작 스타일이 상품 이미지와 약간 상이할 수 있습니다.

- ** 리본 문구 변경 ** : 리본 문구 수정은 주문 후 30분 이내에만 가능하며, 이후 변경 요청 시 화원사 및 택배사 규정에 따라 추가 요금이 발생할 수 있습니다.', '2026-05-18T03:14:24.208535+00:00', '2026-06-03T23:16:19.801+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  delivery_info = EXCLUDED.delivery_info,
  refund_policy = EXCLUDED.refund_policy,
  product_notice = EXCLUDED.product_notice,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.info_templates (id, partner_id, name, delivery_info, refund_policy, product_notice, created_at, updated_at)
VALUES ('2c5c1025-81d1-4639-aa83-213f44f9914f', 'f474a63e-181d-4b1e-a49a-855840ad2484', '기본 안내 템플릿(테스트용)', '- 배송 정보 : ', '- 환불 취소 정보를 입력해주세요.', '- 상품 상세 ', '2026-05-18T04:40:07.697575+00:00', '2026-05-18T04:40:20.116+00:00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  delivery_info = EXCLUDED.delivery_info,
  refund_policy = EXCLUDED.refund_policy,
  product_notice = EXCLUDED.product_notice,
  updated_at = EXCLUDED.updated_at;

-- clients (우리부고 거래처)
INSERT INTO public.clients (id, partner_id, slug, name, logo_url, business_registration_number, verification_status, contact_name, contact_phone, contact_email, call_070_connected, newrun_default_florist_draft, created_at, updated_at)
VALUES ('81031eff-b383-4ccd-b498-cca61a3329e4', 'f474a63e-181d-4b1e-a49a-855840ad2484', 'wooribu', '(주)제이에스브라더스', 'https://dauzaeogqwxiwfmvhfux.supabase.co/storage/v1/object/public/clients/f474a63e-181d-4b1e-a49a-855840ad2484/81031eff-b383-4ccd-b498-cca61a3329e4/1779929681312-d78q8c.png', '1188123147', 'pending', '전병권', '010-4544-7740', 'ddd831025@hanmail.net', TRUE, NULL, '2026-03-17T02:09:45.826555+00:00', '2026-03-17T02:09:45.826555+00:00')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  business_registration_number = EXCLUDED.business_registration_number,
  verification_status = EXCLUDED.verification_status,
  contact_name = EXCLUDED.contact_name,
  contact_phone = EXCLUDED.contact_phone,
  contact_email = EXCLUDED.contact_email,
  call_070_connected = EXCLUDED.call_070_connected,
  newrun_default_florist_draft = EXCLUDED.newrun_default_florist_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.clients (id, partner_id, slug, name, logo_url, business_registration_number, verification_status, contact_name, contact_phone, contact_email, call_070_connected, newrun_default_florist_draft, created_at, updated_at)
VALUES ('fe8da7ea-e9ac-494e-90c7-3f1dc6e6f2ec', 'f474a63e-181d-4b1e-a49a-855840ad2484', 'knauto', '기아자동차', 'https://dauzaeogqwxiwfmvhfux.supabase.co/storage/v1/object/public/clients/f474a63e-181d-4b1e-a49a-855840ad2484/fe8da7ea-e9ac-494e-90c7-3f1dc6e6f2ec/1771826963374-utxkl9.png', '123121234', 'pending', '홍길동', '01012341234', 'damdang@gmail.com', TRUE, NULL, '2026-02-12T23:55:41.574644+00:00', '2026-02-19T04:22:11.251987+00:00')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  business_registration_number = EXCLUDED.business_registration_number,
  verification_status = EXCLUDED.verification_status,
  contact_name = EXCLUDED.contact_name,
  contact_phone = EXCLUDED.contact_phone,
  contact_email = EXCLUDED.contact_email,
  call_070_connected = EXCLUDED.call_070_connected,
  newrun_default_florist_draft = EXCLUDED.newrun_default_florist_draft,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.clients (id, partner_id, slug, name, logo_url, business_registration_number, verification_status, contact_name, contact_phone, contact_email, call_070_connected, newrun_default_florist_draft, created_at, updated_at)
VALUES ('d3db3bec-608f-4954-a8b8-c7d1aacf7c76', 'f474a63e-181d-4b1e-a49a-855840ad2484', 'hyundaimotor', '현대자동차', 'https://dauzaeogqwxiwfmvhfux.supabase.co/storage/v1/object/public/clients/f474a63e-181d-4b1e-a49a-855840ad2484/pending/1778652823269-3u1h77.png', '333-44-55555', 'pending', '박담당', '010-3333-4444', 'park@hyundai.com', FALSE, NULL, '2026-05-13T06:14:34.542723+00:00', '2026-05-13T06:14:34.542723+00:00')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url,
  business_registration_number = EXCLUDED.business_registration_number,
  verification_status = EXCLUDED.verification_status,
  contact_name = EXCLUDED.contact_name,
  contact_phone = EXCLUDED.contact_phone,
  contact_email = EXCLUDED.contact_email,
  call_070_connected = EXCLUDED.call_070_connected,
  newrun_default_florist_draft = EXCLUDED.newrun_default_florist_draft,
  updated_at = EXCLUDED.updated_at;

-- client_call_070_configs (070 · CallCloud)
INSERT INTO public.client_call_070_configs (id, client_id, call_070_number, greeting_message, industry, admin_name, admin_email, admin_phone, sms_text_template, callcloud_registered, created_at, updated_at)
VALUES ('61d91d2b-ed9f-4818-9d79-50229a396a54', 'fe8da7ea-e9ac-494e-90c7-3f1dc6e6f2ec', '07045044182', '안녕하세요 기아자동차에 전화 주셔서 감사합니다.', '화훼', '홍길동', 'damdang@gmail.com', '01012341234', '안녕하세요 기아자동차입니다.', TRUE, '2026-05-07T03:55:44.145638+00:00', '2026-05-07T03:55:41.767+00:00')
ON CONFLICT (id) DO UPDATE SET
  call_070_number = EXCLUDED.call_070_number,
  greeting_message = EXCLUDED.greeting_message,
  industry = EXCLUDED.industry,
  admin_name = EXCLUDED.admin_name,
  admin_email = EXCLUDED.admin_email,
  admin_phone = EXCLUDED.admin_phone,
  sms_text_template = EXCLUDED.sms_text_template,
  callcloud_registered = EXCLUDED.callcloud_registered,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.client_call_070_configs (id, client_id, call_070_number, greeting_message, industry, admin_name, admin_email, admin_phone, sms_text_template, callcloud_registered, created_at, updated_at)
VALUES ('b00f1f26-2581-4474-9dac-a801de769d38', 'd3db3bec-608f-4954-a8b8-c7d1aacf7c76', '07045044187', '안녕하세요 현대자동차에 전화 주셔서 감사합니다.', '화훼', '박담당', 'park@hyundai.com', '010-3333-4444', '안녕하세요 현대자동차입니다.', FALSE, '2026-05-13T06:14:47.110625+00:00', '2026-05-13T06:14:47.110625+00:00')
ON CONFLICT (id) DO UPDATE SET
  call_070_number = EXCLUDED.call_070_number,
  greeting_message = EXCLUDED.greeting_message,
  industry = EXCLUDED.industry,
  admin_name = EXCLUDED.admin_name,
  admin_email = EXCLUDED.admin_email,
  admin_phone = EXCLUDED.admin_phone,
  sms_text_template = EXCLUDED.sms_text_template,
  callcloud_registered = EXCLUDED.callcloud_registered,
  updated_at = EXCLUDED.updated_at;

INSERT INTO public.client_call_070_configs (id, client_id, call_070_number, greeting_message, industry, admin_name, admin_email, admin_phone, sms_text_template, callcloud_registered, created_at, updated_at)
VALUES ('5a1ed0d9-7bf6-400b-bc27-09634779ef8c', '81031eff-b383-4ccd-b498-cca61a3329e4', '050827935382', '안녕하세요 (주)제이에스브라더스에 전화 주셔서 감사합니다.', '화훼', '전병권', 'ddd831025@hanmail.net', '010-4544-7740', '안녕하세요 (주)제이에스브라더스입니다.', TRUE, '2026-05-21T00:00:09.953148+00:00', '2026-06-05T00:53:31.609+00:00')
ON CONFLICT (id) DO UPDATE SET
  call_070_number = EXCLUDED.call_070_number,
  greeting_message = EXCLUDED.greeting_message,
  industry = EXCLUDED.industry,
  admin_name = EXCLUDED.admin_name,
  admin_email = EXCLUDED.admin_email,
  admin_phone = EXCLUDED.admin_phone,
  sms_text_template = EXCLUDED.sms_text_template,
  callcloud_registered = EXCLUDED.callcloud_registered,
  updated_at = EXCLUDED.updated_at;

-- FK 보정 (info_templates INSERT 이후 — 02번 seed 카테고리/상품 연결)
UPDATE public.product_categories SET default_template_id = '1a8560d3-f1b8-409d-a87c-2ede353ed47a', updated_at = now() WHERE id = 'ca110001-0000-0000-0000-000000000006';
UPDATE public.product_categories SET default_template_id = '1a8560d3-f1b8-409d-a87c-2ede353ed47a', updated_at = now() WHERE id = 'ca110001-0000-0000-0000-000000000005';

COMMIT;

-- 검증:
-- SELECT count(*) FROM info_templates WHERE partner_id = 'f474a63e-181d-4b1e-a49a-855840ad2484';
-- SELECT name, slug FROM clients WHERE partner_id = 'f474a63e-181d-4b1e-a49a-855840ad2484';