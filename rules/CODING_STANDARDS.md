# 코딩 표준 (Coding Standards)

**프로젝트:** 콜링크 쇼핑몰 플랫폼  
**최종 수정:** 2026-02-09 15:32 (KST)

---

## 1. 기술 스택

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand (모바일), React Query (서버 상태)
- **Language**: 한국어 (UI 텍스트), 영어 (코드/변수/주석)

---

## 2. 네이밍 컨벤션

| 유형 | 규칙 | 예시 |
|------|------|------|
| 파일/폴더 | kebab-case 또는 PascalCase (컴포넌트) | `product-list.tsx`, `ProductCard.tsx` |
| 컴포넌트 | PascalCase | `ProductCard`, `OrderList` |
| 함수/변수 | camelCase | `getClientList`, `clientSourceId` |
| 상수 | UPPER_SNAKE_CASE | `MAX_PAGE_SIZE`, `API_BASE_URL` |
| DB 컬럼 | snake_case | `client_source_id`, `partner_id` |
| API 경로 | kebab-case | `/api/order-items`, `/api/client-list` |

---

## 3. 폴더 구조 (권장)

```
/app
  /(admin)          # 파트너 어드민
  /(mobile)         # 거래처 사용자 모바일
  /api              # API Routes
/components
  /admin            # 어드민 전용 컴포넌트
  /mobile           # 모바일 전용 컴포넌트
  /ui               # 공통 UI (Shadcn 등)
/lib
  /api              # API 클라이언트
  /utils            # 유틸 함수
  /hooks            # 커스텀 훅
/types
/docs
/rules
```

---

## 4. 컴포넌트 작성 원칙

- **단일 책임**: 한 컴포넌트는 한 가지 역할
- **재사용성**: 공통 로직은 hooks, utils로 분리
- **타입 안전**: Props, API 응답에 TypeScript 인터페이스 적용
- **접근성**: 시맨틱 HTML, aria 속성 고려

---

## 5. 스타일 (Tailwind)

- 유틸리티 클래스 우선, `@apply` 최소화
- 반응형: 모바일 우선 (sm:, md: 순)
- 색상/간격: TRD 명세의 디자인 토큰 준수

---

## 6. 에러 처리

- API 에러: 일관된 에러 응답 형식 (code, message)
- 클라이언트: 사용자 친화적 메시지, 로깅 분리
- 070/CallCloud 연동 실패: 명확한 Alert 및 로그

---

## 7. 주석 및 문서화

- 복잡한 로직: 주석으로 의도 설명
- 공개 함수: JSDoc 또는 TSDoc
- 변경 이력: 규칙 변경 시 rules/ 파일에 기록

---

## 8. 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2025-02-06 | 초기 코딩 표준 작성 |

---

*프로젝트 진행에 따라 추가·수정됩니다.*
