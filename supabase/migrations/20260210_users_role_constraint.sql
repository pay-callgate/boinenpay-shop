-- 역할 재정의 반영: users.role은 partner_admin | client_staff | end_customer 만 허용 (PRD/shrimp-rules)
-- 기존 check 제약 제거 후 새 제약 추가 (client_admin 제거)

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('partner_admin', 'client_staff', 'end_customer'));
