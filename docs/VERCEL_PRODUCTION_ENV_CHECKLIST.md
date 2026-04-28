# Vercel Production — 환경 변수 체크리스트 & 롤백 계획

**전제:** 우리부고·뉴런 **실운영계** 연동 테스트. 비밀 값은 이 파일에 넣지 않습니다. 아래 JSON은 **키 목록·형식 참고**용이며, 값은 Vercel Dashboard 또는 `vercel env`로만 설정합니다.

---

## 1. 복붙 참고용 — 변수 키 목록 (JSON)

로컬 검증·내부 문서용으로만 사용하세요. 저장소에 실제 값을 커밋하지 마세요.

```json
{
  "NEXT_PUBLIC_APP_URL": "https://www.calllinkshop.com",
  "NEXTAUTH_URL": "https://www.calllinkshop.com",
  "NEXTAUTH_SECRET": "",
  "NEXT_PUBLIC_SUPABASE_URL": "",
  "SUPABASE_SERVICE_ROLE_KEY": "",

  "NEWRUN_ASSOC_INTRANET_ID": "",
  "NEWRUN_ROSEWEB_PW": "",
  "NEWRUN_RW_RETURNURL": "https://www.calllinkshop.com/wooribugo/wooribu/newrun/po-return",
  "NEWRUN_ASSOC_CODE": "",
  "NEWRUN_INTRANET_POST_URL": "http://ext2intra.roseweb.co.kr/intranet_post.html",
  "NEWRUN_ENABLED": "true",
  "NEWRUN_MOCK": "false",
  "NEWRUN_ASSOC_BASE_URL": "http://www.kot45.com",
  "NEWRUN_PO_RETURN_SECRET": "",

  "VIEWPAY_API_BASE_URL": "",
  "VIEWPAY_MERCHANT_ID": "",
  "VIEWPAY_CHANNEL_ID": "",
  "VIEWPAY_APP_ID": "",
  "VIEWPAY_APP_KEY": "",
  "VIEWPAY_WEBHOOK_URL": "",

  "KAKAO_CLIENT_ID": "",
  "KAKAO_CLIENT_SECRET": "",
  "NAVER_CLIENT_ID": "",
  "NAVER_CLIENT_SECRET": "",

  "MSGAGENT_USER_ID": "",
  "MSGAGENT_CALLBACK": "",
  "MSGAGENT_SENDER_KEY": "",
  "MSGAGENT_TEMPLATE_CODE": "",
  "MSGAGENT_BASE": "https://api2.msgagent.com",

  "NEXT_PUBLIC_WOORIBUGO_CS_TEL": "",
  "NEWRUN_ERROR_WEBHOOK_URL": "",
  "NEWRUN_DEFAULT_RW_METHOD": "1",

  "_comment": "NEWRUN_ROSEWEB_ID 는 레거시 폴백(선택). NEWRUN_ASSOC_INTRANET_ID 가 있으면 불필요."
}
```

**롤백·비상 시 빠르게 끄기:**

```json
{
  "NEWRUN_ENABLED": "false",
  "NEWRUN_MOCK": "false"
}
```

`NEWRUN_ENABLED=false`이면 새 `intranet_post` 발주 시도는 스킵 처리됩니다(기존 코드 경로).

---

## 2. 배포 전 수동 체크 (짧게)

1. `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` — **프로덕션 호스트와 동일**(www 유무 포함).
2. `NEWRUN_RW_RETURNURL` — 뉴런·우리부고와 합의한 **정확한 HTTPS 경로**.
3. 실발주 전: `NEWRUN_MOCK=false`, `NEWRUN_ENABLED=true` 인지 확인.
4. 테스트 1건 직후: Vercel Runtime Logs에서 `[Newrun:Submit]` / `[Newrun:PoReturn]` / `[Newrun:delivery-status]` 유무 확인.
5. `NEWRUN_PO_RETURN_SECRET` 사용 시 — 뉴런이 **`nrpt` 쿼리 유지**하는지 사전 확인.

---

## 3. 롤백 계획

### 3.1 즉시 완화 (코드 재배포 없음)

| 순서 | 조치 | 효과 |
|------|------|------|
| 1 | Vercel **Environment Variables**에서 `NEWRUN_ENABLED` → `false` 저장 후 **Redeploy** (또는 다음 요청부터 반영되는지 환경에 따라 재배포) | 신규 **intranet_post 자동/수동 발주**가 스킵됨 |
| 2 | 필요 시 `NEWRUN_MOCK=true`는 혼동을 피하려면 켜지 말고, Mock이면 네트워크도 안 나감 — **운영 검증 중엔 `false` 유지 권장** | — |
| 3 | 우리부고에 **발주/콜백 일시 중단** 공지 (이미 노티 채널 있음) | 인적 오류·중복 조작 방지 |

### 3.2 Vercel 배포 단위 롤백

| 순서 | 조치 | 효과 |
|------|------|------|
| 1 | Vercel Dashboard → Project → **Deployments** → 문제 없던 **이전 Production Deployment** → **Promote to Production** | 해당 배포 시점 코드로 되돌림 |
| 2 | 롤백 배포의 env는 **현재 Production env와 동일**함을 인지(환경 변수는 배포와 별도). 위 3.1처럼 `NEWRUN_ENABLED`만 먼저 끄는 게 더 빠를 수 있음 | |

### 3.3 Git + 재배포 롤백

| 순서 | 조치 | 효과 |
|------|------|------|
| 1 | `main` 에서 문제 커밋 **revert** PR 또는 해당 커밋으로 **reset 후 force**(팀 규칙에 따름) | 저장소 기준 이전 동작 |
| 2 | Vercel가 Git 연동이면 **자동 배포** 또는 수동 **Deploy** | 프로덕션이 안전 커밋을 가리킴 |

### 3.4 뉴런·우리부고 쪽

- 이미 나간 **주문 1건**에 대해: 결과코드·중복(20)·취소 정책은 **우리부고 운영 정책**에 따름.
- **콜백 URL 변경**은 다음 배포·env 정리 후 재협의.

### 3.5 권장 순서 (한 줄)

**`NEWRUN_ENABLED=false` → (필요 시) Vercel Promote 롤백 → Git revert → 우리부고 공유**

---

## 4. 연락·기록

- 롤백 수행 시각 / 담당 / 배포 ID / `NEWRUN_*` 변경 여부를 내부에 짧게 남기면 이후 감사·재현에 유리합니다.
