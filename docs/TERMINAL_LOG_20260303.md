# 터미널 로그 (2026-03-03)

**출처:** `terminals/1.txt` 612–1045 라인  
**내용:** Next.js 개발 서버 로그 (어드민/쇼핑몰/세션·API·장바구니)

---

## 로그 본문

아래는 `terminals/1.txt` 612–1045 라인 원문과 동일한 내용입니다. (일부 생략 없이 전부 포함하려면 해당 터미널 파일을 직접 참고하세요.)

```text
[API /api/partner] { userId: '5365db37-d5f5-43e3-bf91-4278d397a663', hasAdminRow: true, partnerId: 'f474a63e-181d-4b1e-a49a-855840ad2484', adminError: null }
[API /api/partner] 200 { partnerId: 'f474a63e-181d-4b1e-a49a-855840ad2484', company_name: '주식회사 우리부고' }
 GET /api/partner 200 in 367ms
✅ [auth.ts] 세션 생성 완료. userId: 5365db37-d5f5-43e3-bf91-4278d397a663
...
 GET /testpartner/knauto 200 in 980ms
[CART GET] { hasSession: true, userId: '5365db37-d5f5-43e3-bf91-4278d397a663', clientId: 'fe8da7ea-e9ac-494e-90c7-3f1dc6e6f2ec', at: '2026-03-03T05:48:18.039Z' }
[CART GET] 200 { userId: '5365db37-d5f5-43e3-bf91-4278d397a663', clientId: 'fe8da7ea-e9ac-494e-90c7-3f1dc6e6f2ec', cartId: '28806451-ad15-4e89-8cde-c07800e9c747', itemsCount: 1 }
...
 GET /api/mypage/profile?clientId=fe8da7ea-e9ac-494e-90c7-3f1dc6e6f2ec 403 in 334ms
[mypage/addresses] 빈 목록 — session.user.id: 5365db37-d5f5-43e3-bf91-4278d397a663 (DB addresses.user_id와 일치하는지 확인)
 POST /api/auth/signout 200 in 17ms
...
✅ [auth.ts] 기존 유저 발견: 9dd4d09b-b138-4383-9483-29cc2e683d2e
✅ [auth.ts] 토큰에 UUID 저장 완료: 9dd4d09b-b138-4383-9483-29cc2e683d2e
 GET /testpartner/knauto/checkout 200 in 434ms
[CART GET] 200 { userId: '9dd4d09b-b138-4383-9483-29cc2e683d2e', clientId: 'fe8da7ea-e9ac-494e-90c7-3f1dc6e6f2ec', cartId: 'a84d54d9-8c35-45bd-ab32-6cc7964d6dbb', itemsCount: 0 }
...
[API /api/partner] { userId: '9dd4d09b-b138-4383-9483-29cc2e683d2e', hasAdminRow: false, partnerId: null, adminError: null }
[API /api/partner] data: null — partner_admins에 해당 user_id 없음
 GET /api/partner 200 in 233ms
...
 GET /api/auth/session 200 in 32ms (compile: 3ms, render: 29ms)
```

---

## 요약

- **세션 A (파트너 어드민):** `userId: 5365db37-d5f5-43e3-bf91-4278d397a663` → `/api/partner` 200, `hasAdminRow: true`, `partnerId` 정상.
- **쇼핑몰·체크아웃:** 동일 세션으로 CART GET 200, 장바구니 1건. `/api/mypage/profile` 403, `/api/mypage/addresses` 200(빈 목록).
- **로그아웃 후 다른 계정 로그인:** `9dd4d09b-b138-4383-9483-29cc2e683d2e` → CART GET 200, `itemsCount: 0`. 어드민 접속 시 `/api/partner`는 `hasAdminRow: false`, `data: null` (해당 user_id는 partner_admins에 없음).
