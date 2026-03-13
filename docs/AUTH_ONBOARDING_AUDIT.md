# 인증 및 온보딩 프로세스 감사 보고서

**기준 문서:** PRD §2.1 인증 및 온보딩 (Role-Based Onboarding)  
**검수일:** 2026-02-10  
**목적:** 파트너사/거래처 유저 프로세스와 코드베이스 정합성 점검, 갭 식별

---

## 1. 요약


| 구분                         | PRD 요구                        | 현재 구현                                     | 판정      |
| -------------------------- | ----------------------------- | ----------------------------------------- | ------- |
| 파트너 로그인                    | SNS(구글/카카오/네이버)               | ✅ 동일                                      | 적합      |
| 파트너 권한 연결                  | 기업 등록·검증 후 대시보드               | user_id → partner_admins → partners       | ✅ 적합    |
| partners.email vs 로그인 이메일  | (명시 없음)                       | **연관 없음** — partners.email = 대표자 이메일      | ✅ 설계 적합 |
| 파트너 기업 등록 시 사업자번호 검증       | 검증 후 DB 세팅 필수                 | **형식 검증만**, 검증 API 미호출, 등록 시 무조건 verified | ⚠️ 갭    |
| 거래처 등록(파트너가 추가) 시 사업자번호 검증 | DB에 거래처 기업 검증 세팅 필수           | 사업자번호 필드만 있음, **검증 API 미호출**, 상태 수동 선택    | ⚠️ 갭    |
| 진입 시나리오 A (링크 → 자동 매칭)     | 로그인 완료 즉시 해당 Client로 자동 소속 매칭 | ✅ 구현됨                                     | 적합      |
| 진입 시나리오 B (소속 기업 찾기)       | 팝업 검색·선택→매핑                   | OrderGuard + ClientSearchModal            | ✅ 적합    |
| 다중 거래처                     | 불가 (1:1)                      | user_clients unique on user_id            | ✅ 적합    |


---

## 2. partners.email과 로그인 이메일의 연관성

### 질문

> "partners 테이블의 우리부고에 있는 email 필드는 [aaa@gmail.com](mailto:aaa@gmail.com)인데, 구글 메일([neonobless78@gmail.com](mailto:neonobless78@gmail.com))로 로그인한 것과 파트너사/거래처 인증, 온보딩 프로세스는 연관성이 없는가?"

### 결론: **연관성 없음이 맞고, 설계상 올바릅니다.**

- **partners.email**  
  - 스키마/코드상 **「대표자 이메일」** (기업 등록 폼의 `representativeEmail`).  
  - 용도: 기업(파트너사) 연락용 이메일.
- **로그인 이메일**  
  - **users.email** (SNS 로그인 시 저장).  
  - 파트너 권한 연결은 **partner_admins** 테이블로만 결정됨:  
  `session.user.id` (users.id) → `partner_admins.user_id` → `partner_admins.partner_id` → `partners`.
- **PRD**  
  - "로그인과 동시에 기업 등록 화면 노출", "사업자정보 입력 및 검증 후 파트너 어드민 권한 획득"만 명시.  
  - "로그인 이메일과 기업 대표자 이메일이 같아야 한다"는 요구 없음.

따라서 **[neonobless78@gmail.com](mailto:neonobless78@gmail.com)으로 로그인**하고 **기업 등록 시 대표자 이메일을 [aaa@gmail.com](mailto:aaa@gmail.com)으로 입력**한 경우,  
파트너 권한은 `partner_admins`(user_id ↔ partner_id)로만 연결되므로 **정상 동작**이며, partners.email과 로그인 이메일은 의도적으로 분리된 값입니다.

---

## 3. 파트너사 온보딩 (기업 등록)

### 3.1 흐름 (구현됨)

1. `/admin/login` → SNS 로그인 → `users` upsert, JWT에 `userId`.
2. `/admin` 접근 시 `(dashboard)/layout.tsx`:
  `partner_admins`에서 `session.user.id`로 `partner_id` 조회 → 없으면 `/admin/onboarding/partner` 리다이렉트.
3. `/admin/onboarding/partner`: `PartnerRegistrationForm` → POST `/api/partner/register`.
4. `partner/register`: partners insert + partner_admins insert + users.role = partner_admin.
5. 이후 `partners.verification_status === 'verified'`일 때만 대시보드 진입 (layout에서 검사).

### 3.2 사업자번호 검증 (갭)

- **PRD:** "사업자등록번호 검증 후 적법한 파트너사만 대시보드 및 기타 화면 접근 가능. **DB에 기업 검증(사업자등록번호) 세팅 필수**."
- **현재 구현:**
  - `PartnerRegistrationForm`: 사업자번호 입력만 함. `**/api/verify/business-registration` 호출 없음.**
  - `POST /api/partner/register`:  
    - 사업자번호 10자리 숫자 **형식 검증만** 수행.  
    - **검증 API 호출 없이** `verification_status: "verified"`, `verified_at: now()` 로 insert.
- `**/api/verify/business-registration`:**  
  - 존재하나 **목업 응답** (항상 valid: true).  
  - 주석: "TODO: 국세청/공공 API 연동 시 여기서 호출".

**갭:**  

- 기업 등록 폼에서 **사업자등록번호 검증 API를 호출하지 않음.**  
- 실제 검증 없이 DB에 기업 검증(verified)이 세팅되고 있음.

---

## 4. 거래처 등록 (파트너 어드민이 거래처 추가)

### 4.1 흐름 (구현됨)

- 파트너 어드민 → 거래처 관리 → "거래처 등록" → `ClientRegistrationModal`.
- 필드: 거래처명, slug, **사업자등록번호**, 대표자, 연락처, 주소, **거래 상태(심사중/정상/중지)** 등.
- POST `/api/clients` → `clients` insert.

### 4.2 사업자번호 검증 (갭)

- **PRD:** "파트너사가 어드민에서 '거래처'를 미리 등록해 두며, **DB에 거래처 기업 검증(사업자등록번호) 세팅 필수**."
- **현재 구현:**
  - `ClientRegistrationModal`: 사업자등록번호 **입력 필드만** 있음.  
  `**/api/verify/business-registration` 호출 없음.**
  - "거래 상태"는 **드롭다운 수동 선택** (심사중/정상/중지), 기본 "pending".
  - POST `/api/clients`: 받은 `verificationStatus`를 그대로 저장.  
  사업자번호 형식 검증이나 검증 API 호출 없음.

**갭:**  

- 거래처 등록 시 **사업자번호 검증 로직이 반영되어 있지 않음.**  
- 검증된 거래처만 "정상"으로 두려면, 현재는 어드민이 수동으로 "정상"을 선택하는 방식뿐임.

---

## 5. 거래처 직원 온보딩 (소속 매칭)

### 5.1 진입 시나리오 A — 링크 진입 후 자동 매칭

- **PRD:** "`/{sub}/{clientSlug}` 진입 시: 미로그인이면 로그인 유도 → **로그인 완료 즉시 해당 Client로 자동 소속 매칭** (user_clients insert/update)."
- **구현:**  
  - `app/[subdomain]/[clientSlug]/page.tsx`: 로그인 상태 + partner/client 있을 때 `autoMatch(clientSlug, partner.id)` 호출.  
  - `useUserClient` → POST `/api/user-clients` (clientSlug, partnerId, role: member).  
  - `user_clients`에 1:1 매핑 생성.
- **판정:** ✅ PRD와 일치.

### 5.2 진입 시나리오 B — 소속 기업 찾기

- **PRD:** "`/{sub}` 진입 후 주문 시도 시 소속 정보 없으면 **[소속 기업 찾기] 팝업** 노출 → 수동 검색·선택→매핑."
- **구현:**  
  - `OrderGuard`: 로그인됐지만 `isMatched` 없으면 `ClientSearchModal` 노출.  
  - 검색 API: GET `/api/user-clients/search?partnerId=...&q=...` (거래처 이름 검색).  
  - 선택 시 POST `/api/user-clients` (clientId/clientSlug, partnerId).
- **판정:** ✅ PRD와 일치.

### 5.3 소속 매칭 시 거래처 검증 여부

- **현재:** POST `/api/user-clients`는 `clients.verification_status`를 **확인하지 않음.**  
미검증(pending) 거래처라도 소속 매칭 가능.
- **PRD:** "DB에 거래처 기업 검증(사업자등록번호) 세팅 필수" — 정책상 **검증된 거래처만** 소속 허용할지 여부는 선택 사항.  
필요 시 API에서 `clients.verification_status === 'verified'`인 경우만 매칭 허용하도록 추가 가능.

---

## 6. 개선 제안 (PRD 준수)

### 6.1 파트너 기업 등록

1. **기업 등록 폼에서 검증 단계 추가**
  - 사업자등록번호 입력 후 "검증하기" 버튼 또는 blur 시 POST `/api/verify/business-registration` 호출.  
  - 응답 `valid: true`일 때만 "등록" 버튼 활성화 또는 다음 단계로 진행.
2. **POST /api/partner/register**
  - (선택) 검증 API를 서버에서 한 번 더 호출한 뒤, `valid`일 때만 `verification_status: "verified"` 저장.  
  - 또는 클라이언트에서 검증 성공 후에만 등록 요청을 보내도록 유지.

### 6.2 거래처 등록

1. **ClientRegistrationModal**
  - 사업자등록번호 입력 후 "검증하기" 또는 자동 검증 호출: POST `/api/verify/business-registration`.  
  - 검증 성공 시 `verification_status`를 "verified"(또는 "정상")로 설정해 전송.  
  - 검증 실패 시 "심사중" 또는 저장 불가 처리.
2. **POST /api/clients**
  - (선택) 사업자번호 10자리 형식 검증.  
  - (선택) 검증 API 연동 시, 검증 결과에 따라 `verification_status` 결정.

### 6.3 검증 API

- `/api/verify/business-registration`:  
  - 국세청/공공 API 연동 시 실제 검증 후 `valid`, `companyName`, `businessStatus` 등 반영.  
  - 현재는 목업이므로, 위 폼 연동만으로도 "검증 후 DB 세팅" 흐름은 PRD에 맞출 수 있음.

---

## 7. 참고 파일


| 구분         | 파일                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 파트너 권한 조회  | `app/admin/(dashboard)/layout.tsx`, `app/api/partner/route.ts`                                                               |
| 파트너 기업 등록  | `app/admin/onboarding/partner/page.tsx`, `components/admin/PartnerRegistrationForm.tsx`, `app/api/partner/register/route.ts` |
| 사업자 검증 API | `app/api/verify/business-registration/route.ts`                                                                              |
| 거래처 등록     | `components/admin/ClientRegistrationModal.tsx`, `app/api/clients/route.ts`                                                   |
| 소속 매칭      | `app/api/user-clients/route.ts`, `lib/user-client.ts`, `hooks/useUserClient.ts`                                              |
| 자동 매칭      | `app/[subdomain]/[clientSlug]/page.tsx`                                                                                      |
| 소속 기업 찾기   | `components/shop/OrderGuard.tsx`, `components/shop/ClientSearchModal.tsx`                                                    |


