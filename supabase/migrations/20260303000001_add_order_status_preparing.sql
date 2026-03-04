-- 방안 A: 주문 상태 'preparing'(배송준비중) 추가
-- orders_status_check 위반 해결: UI/API의 'preparing'을 DB에서 허용

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'received',
      'confirmed',
      'preparing',
      'shipping',
      'delivered',
      'confirmed_purchase',
      'cancelled',
      'returned'
    )
  );
