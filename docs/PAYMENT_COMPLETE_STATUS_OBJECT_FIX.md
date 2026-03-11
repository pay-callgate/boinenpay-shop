# 결제 완료 페이지 "상태: [object Object]" 오류 원인 및 수정 계획

**일자:** 2026-03-12  
**증상:** 정상 결제 후 완료 페이지에서 "결제가 완료되지 않았습니다. (상태: [object Object])" 표시.

---

## 1. 원인 분석
- app/[subdomain]/[clientSlug]/order/complete/page.tsx

### 1.1 흐름 정리

- **URL:** `?orderId=xxx&data={"event":{"eventCode":"done","resultCode":"0000","message":"결제 성공","data":{"cgTid":"BOINENS9504a82ccbbd493d962d",...}}}`  
- **프론트(complete/page.tsx):** `getPaymentIdFromSearch(searchParams)` 가 `data` 쿼리를 파싱해 **event.data.cgTid** 를 추출 → **cgTid** 로 complete API 호출까지 정상 동작하는 것으로 보임. (cgTid가 없었으면 "결제 정보가 없습니다"가 뜸.)
- **백엔드(complete/route.ts):** `GET /api/payment/viewpay/complete?orderId=xxx&cgTid=BOINENS...` 호출 → ViewPay **get-payment-info** 호출 후, 응답에서 **결제 상태**를 읽어 성공 여부를 판단함.

### 1.2 실제 원인 (백엔드)

- **에러 문구 "(상태: [object Object])"** 는 **문자열이 아닌 값**을 `message`에 넣을 때 JavaScript가 `String(객체)` 로 바꿔서 생기는 현상입니다.
- 즉, ViewPay **get-payment-info** 응답에서 **결제 상태 필드가 문자열이 아니라 객체**로 옵니다.
  - 예: `response.paymentStatus = { code: "PG_APPROVAL_SUCCESS", message: "..." }`  
  - 또는 `response.status = { value: "PG_APPROVAL_SUCCESS" }` 등 중첩 구조.
- 현재 코드는 아래처럼 **문자열만** 가정합니다.

  ```ts
  const paymentStatus = (raw?.paymentStatus ?? raw?.payment_status ?? raw?.status ?? raw?.payStatus) as string | undefined;
  if (!paymentStatus || !PAYMENT_SUCCESS_STATUSES.includes(paymentStatus)) {
    return NextResponse.json({
      success: false,
      message: `결제가 완료되지 않았습니다. (상태: ${paymentStatus ?? "unknown"})`,
    }, { status: 400 });
  }
  ```

- **객체가 들어오면:**
  - `PAYMENT_SUCCESS_STATUSES.includes(객체)` → 항상 `false` (배열에는 문자열만 있음).
  - `message` 에 `${paymentStatus}` 를 넣을 때 객체가 문자열로 변환되며 **"[object Object]"** 가 됨.

**결론:**  
- **프론트(complete/page.tsx)** 의 `data` 파싱·cgTid 추출은 정상 동작하고 있음.  
- **백엔드(complete/route.ts)** 에서 get-payment-info 응답의 **결제 상태가 객체인 경우**를 처리하지 않아, 성공인데도 실패로 판단하고 `(상태: [object Object])` 메시지를 반환하는 것이 원인입니다.

---

## 2. 수정 계획

**대상 파일:** `app/api/payment/viewpay/complete/route.ts`

### 2.1 결제 상태 값 정규화 (객체 → 문자열)

- get-payment-info 응답에서 상태를 읽은 뒤, **객체이면** 안쪽 문자열을 꺼내서 사용합니다.
- 예: `paymentStatus` 가 객체일 때  
  - `paymentStatus?.code` 또는 `paymentStatus?.status` 또는 `paymentStatus?.value` 등 **문자열**을 우선 사용.
- 정규화 유틸 예시:

  ```ts
  function normalizePaymentStatus(raw: unknown): string | undefined {
    if (raw == null) return undefined;
    if (typeof raw === "string") return raw.trim() || undefined;
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      const s = (obj.code ?? obj.status ?? obj.value ?? obj.paymentStatus) as string | undefined;
      return typeof s === "string" ? s.trim() : undefined;
    }
    return undefined;
  }
  ```

- 기존에 `raw?.paymentStatus ?? raw?.payment_status ?? ...` 로 읽는 부분을 **한 번에** 읽어온 뒤, 그 값을 `normalizePaymentStatus(값)` 으로 넘겨 **문자열**을 얻고, 그 문자열로 `PAYMENT_SUCCESS_STATUSES.includes(...)` 및 에러 메시지에 사용합니다.

### 2.2 에러 메시지 안전 처리

- 실패 시 메시지에 상태를 넣을 때, **객체가 그대로 들어가지 않도록** 합니다.
  - 정규화된 **문자열**만 넣거나,
  - 원본이 객체면 `JSON.stringify(paymentStatus)` 또는 `(객체?.code ?? 객체?.status ?? "unknown")` 로 문자열로 바꾼 뒤 메시지에 넣습니다.
- 이렇게 하면 "(상태: [object Object])" 대신 실제 코드/상태 문자열이 노출됩니다.

### 2.3 (선택) 로그 보강

- get-payment-info 응답에서 **결제 상태 필드 원본**을 한 번만 `console.debug` 로 남기면, ViewPay 응답 구조가 달라졌을 때 추적하기 쉬움.

---

## 3. 수정 후 기대 동작

- ViewPay가 **상태를 객체**로 주더라도, 그 안의 `code` / `status` / `value` 등 문자열을 사용해  
  `PAYMENT_SUCCESS_STATUSES` 와 비교하고,  
  성공 상태면 DB 반영 후 `{ success: true, orderNo }` 를 반환합니다.
- 완료 페이지는 기존대로 success 시 주문 완료 UI를 보여줍니다.
- 실패 시에도 "(상태: [object Object])" 대신 실제 상태 코드가 메시지에 나와 디버깅이 수월해집니다.

---

**이 계획대로 `app/api/payment/viewpay/complete/route.ts` 만 수정하면 됩니다. 프론트(complete/page.tsx)는 변경하지 않습니다.**
