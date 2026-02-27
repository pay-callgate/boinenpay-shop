# 아키텍처 규칙 (Architecture Rules)

**프로젝트:** 콜링크 쇼핑몰 플랫폼  
**최종 수정:** 2026-02-09 15:32 (KST)

---

## 1. URL 및 Multi-Tenancy

### 1.1 URL 구조

```
https://{Partner_Subdomain}.{Platform_Domain}/{Client_Slug}
```

- **Partner_Subdomain**: Host에서 추출 → 파트너 식별
- **Client_Slug**: Path 첫 세그먼트 → 거래처 식별
- **client_source_id**: Slug → DB clients.id 매핑 후 세션/쿠키 저장

### 1.2 데이터 격리

- 모든 상품·주문·거래처 쿼리에 `partner_id` 필터 필수
- 주문 생성 시 `client_id` FK 필수 (client_source_id 기반)
- RLS(Row Level Security) 또는 애플리케이션 레벨 필터 적용

---

## 2. 레이어 구분

| 레이어 | 책임 |
|--------|------|
| **Presentation** | UI 컴포넌트, 사용자 입력 |
| **Application** | 비즈니스 로직 오케스트레이션 |
| **Domain** | 핵심 도메인 모델, 규칙 |
| **Infrastructure** | DB, 외부 API, 파일 스토리지 |

---

## 3. 외부 연동

### 3.1 CallCloud (070 콜 시스템)

- 별도 모듈/클래스로 분리 (예: `CallCloudIntegration`, `callcloud.service.ts`)
- [070번호 연결하기] 버튼 → 해당 함수 호출
- 연동 완료 시 Alert: "070번호 연동이 완료되었습니다."

### 3.2 SOLAPI

- 문자 발송 모듈 분리
- 환경 변수로 API 키 관리

### 3.3 PG사

- 결제 모듈 추상화 (여러 PG 교체 가능하도록)
- 웹훅/콜백 보안 검증 필수

---

## 4. 인증/인가

- **파트너 어드민**: 파트너 소속 관리자만 접근
- **거래처 사용자**: 로그인 시 client 매핑 검증
- **API**: JWT 또는 세션 기반, role 기반 접근 제어

---

## 5. 상태 관리

- **서버 상태**: React Query (또는 SWR)
- **클라이언트 상태**: Zustand (모바일)
- **폼 상태**: React Hook Form 등
- **글로벌**: client_source_id, partner_id 등은 컨텍스트 또는 쿠키

---

## 6. 배포 및 환경

- **도메인**: Subdomain 라우팅 지원 (예: *.shopping.com)
- **환경 변수**: `.env.local`, `.env.production` 구분
- **빌드**: Next.js 정적/서버 빌드 정책에 따른 배포

---

## 7. 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-02-06 | 초기 아키텍처 규칙 작성 |

---

*아키텍처 결정 변경 시 본 문서와 TRD를 함께 업데이트합니다.*
