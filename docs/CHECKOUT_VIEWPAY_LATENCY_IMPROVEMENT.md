# 결제하기 → ViewPay 페이지 노출까지 시간 단축 검토

## 1. 현재 흐름 (결제하기 클릭 후)

```
[클라이언트]
  결제하기 클릭
    → POST /api/orders (주문 생성)          ← 대기
    → (옵션) POST /api/mypage/addresses     ← 대기 (기본배송지 저장)
    → POST /api/payment/viewpay/prepare    ← 대기 (ViewPay startpay)
    → window.location.href = redirectUrl   (ViewPay 페이지로 이동)
```

- **체감 지연**: 위 세 단계가 **순차 실행**이라 각 단계 지연이 그대로 합쳐짐.

---

## 2. 병목 요인

| 구간 | 내용 | 예상 지연 |
|------|------|-----------|
| **POST /api/orders** | 클라이언트 검증, 장바구니+상품 조회, 주문/주문항목 INSERT, **상품별 재고 차감(루프)**, 히스토리 INSERT, 파트너/거래처 조회, 알림 발송, 장바구니 삭제 | DB 왕복 다수 + **재고 N건 순차 UPDATE** |
| **POST /api/mypage/addresses** | 기본배송지 저장 시에만 실행. 주문과 무관하므로 대기 불필요 | 수백 ms |
| **POST /api/payment/viewpay/prepare** | 주문 조회, **ViewPay 토큰 발급**(캐시 없으면 1회), **ViewPay startpay** 외부 호출 | 토큰 캐시 시 1회 외부 호출, 미캐시 시 2회 |

---

## 3. 개선 방안

### 3-1. 배송지 저장 비대기 (즉시 적용)

- **현재**: `saveAsDefaultAddress`일 때 `POST /api/mypage/addresses`를 **await**한 뒤 ViewPay prepare 호출.
- **개선**: 주문 생성 성공 후 배송지 저장을 **fire-and-forget**(await 제거)으로 호출하고, 바로 prepare 요청으로 진행.
- **효과**: 기본배송지 저장에 걸리던 수백 ms 제거. 저장 실패해도 주문/결제에는 영향 없음.

### 3-2. 주문 API 내 재고 차감 병렬화 (즉시 적용)

- **현재**: `for (const item of cartItems)` 루프에서 상품별로 `supabase.from("products").update(...)` **순차** 실행.
- **개선**: `Promise.all`로 각 상품 재고 업데이트를 **병렬** 실행.
- **효과**: 장바구니 N건일 때 재고 차감 구간이 약 N배 단축 (DB 지연이 병렬로 겹침).

### 3-3. ViewPay 토큰 선로딩 (선택)

- **현재**: prepare 호출 시 `viewpayPost` → `getAccessToken()`에서 필요 시 토큰 발급 후 startpay 호출.
- **개선**: 체크아웃 페이지 마운트 시 또는 결제하기 클릭 직후 **미리** `GET /api/payment/viewpay/token` 같은 경로로 토큰만 발급해 두고, prepare 시에는 캐시된 토큰만 사용.
- **효과**: prepare 시 토큰 발급 1회 왕복 제거. (이미 캐시되어 있으면 변화 없음.)

### 3-4. 주문 생성과 prepare 순서

- prepare는 **orderId**가 필요하므로 주문 생성 **이후**에만 호출 가능. 두 호출 순서를 바꾸거나 병렬화할 수 없음.

---

## 4. 적용 현황

- **3-1 배송지 저장 비대기**: 체크아웃 페이지에서 적용.
- **3-2 재고 차감 병렬화**: `app/api/orders/route.ts` POST 내 재고 업데이트를 `Promise.all`로 변경.

---

## 5. 참고

- ViewPay 토큰은 `lib/viewpay.ts`의 `cachedToken`으로 서버 메모리 캐시됨. prepare 연속 호출 시 두 번째부터는 토큰 발급 생략.
- 재고 차감 실패 시 현재는 로그만 남기고 주문 생성은 유지하는 정책 유지.
