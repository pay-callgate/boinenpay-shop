/**
 * Supabase SQL Editor 에서 실행할 DDL (파일로 보관).
 * 적용 후 POST /api/admin/notifications/link-kakao 의 DB insert 가 동작합니다.
 */
export const LINK_KAKAO_NOTIFICATIONS_DDL = `
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
`.trim();
