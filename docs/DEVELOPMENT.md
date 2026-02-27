# 개발 계획·진행·구현 (병합 문서)

**병합 소스:** DEVELOPMENT_PLAN.md, DEVELOPMENT_PROGRESS.md, IMPLEMENTATION_PLAN.md, IMPLEMENTATION_REVIEW_AND_NEXT_STEPS.md, MODULE_TASK_COMPARISON.md  
**최종 수정:** 2026-02-10

---

## 목차

1. [개발 계획 요약 (DEVELOPMENT_PLAN)](#1-개발-계획-요약)
2. [개발 진행 현황 (DEVELOPMENT_PROGRESS)](#2-개발-진행-현황)
3. [구현 계획·Task (IMPLEMENTATION_PLAN)](#3-구현-계획task)
4. [리뷰 및 다음 단계 (IMPLEMENTATION_REVIEW)](#4-리뷰-및-다음-단계)
5. [모듈·Task 비교 (MODULE_TASK_COMPARISON)](#5-모듈task-비교)

---

## 1. 개발 계획 요약

- **목표:** Multi-Tenant B2B2C 쇼핑몰 플랫폼 (파트너·거래처·최종 고객).
- **스택:** Next.js 14, Supabase, NextAuth, Tailwind, Shadcn.
- **Phase:** M0(인프라) → M1(파트너 온보딩) → M2(상품) → M3(거래처) → M3.5(소속 매칭) → M4(쇼핑몰) → M5(주문) → M6(마이페이지) 등.
- **우선순위:** 결제 PG(M7/10), 후기·Q&A(M9), CallCloud 070 자동화(Phase 10) 등.

*(상세 Phase·마일스톤은 원본 DEVELOPMENT_PLAN.md 참고)*

---

## 2. 개발 진행 현황

- **완료 Phase:** 0, 1, 2, 3, 3.5, 4, 5, 6, 8 (인프라, 온보딩, 상품·거래처·소속 매칭, 쇼핑몰, 주문, 마이페이지, 최근 본 상품).
- **부분 완료:** Phase 10 (CallCloud 070 — 브라우저·자동화 일부).
- **미구현:** Phase 7 결제 PG, Phase 9 후기·Q&A.
- **개선 완료:** 재고 자동 차감/복구, 품절 전환, 엑셀 다운로드, 신규 주문 알림 등.

*(상세 Task별 완료 내역은 원본 DEVELOPMENT_PROGRESS.md 참고)*

---

## 3. 구현 계획·Task

- **T0:** 프로젝트 초기화, DB 스키마, NextAuth, Multi-Tenant 유틸, 루트 라우팅.
- **T1:** 파트너 SNS 로그인, 기업 등록·검증, 어드민 대시보드.
- **T2:** 카테고리 CRUD, 상품 목록·에디터·재고·이미지.
- **T3:** 거래처 CRUD, 링크 주소 UI, 070 설정.
- **T3.5:** 링크 진입 자동 매칭, 소속 기업 찾기(팝업), 미매칭 가드.
- **T4:** 쇼핑몰 라우팅·세션·메인·PLP·PDP·장바구니·주문/결제(T4-6b 원자 트랜잭션).
- **T5~T6:** 주문 관리, 마이페이지(주문·배송지·회원정보·관심상품).
- **T8:** 최근 본 상품(product_views).

*(Task 번호·산출물·의존성은 원본 IMPLEMENTATION_PLAN.md 참고)*

---

## 4. 리뷰 및 다음 단계

- **완료 검토:** Phase 0~6, 8 구현 완료; 테스트 착수 가능.
- **다음 작업:** PG 연동(M7), 후기·Q&A(M9), 070 자동 폼 입력 완성, RLS·보안 점검.
- **문서 정합성:** PRD·TRD·ERD·API_SPEC·PAGE_STRUCTURE_FLOW·IMPLEMENTATION_PLAN 간 정합성 유지.

*(상세 액션 아이템은 원본 IMPLEMENTATION_REVIEW_AND_NEXT_STEPS.md 참고)*

---

## 5. 모듈·Task 비교

- **M3.5 vs M7:** 사용자 소속 매칭을 M3 직후·M4 직전 필수 단계로 통일(M7→M3.5).
- **T0-5:** 루트 라우팅(도메인·파트너/거래처 URL·localhost) 현재 프로젝트에만 명시 — 유지 권장.
- **T2:** 이미지 스토리지 선행(T2-0) 제안 vs 현재는 에디터 내 업로드; 재고·Safety Stock은 현재 반영.
- **T4-6:** 주문 생성+장바구니 비우기+재고 차감 원자 트랜잭션(T4-6b) 명시.

*(제안 vs 현재 Task 비교표는 원본 MODULE_TASK_COMPARISON.md 참고)*

---

## 변경 이력 (병합)

| 날짜 (KST) | 내용 |
|------------|------|
| 2026-02-10 | DEVELOPMENT_PLAN, DEVELOPMENT_PROGRESS, IMPLEMENTATION_PLAN, IMPLEMENTATION_REVIEW_AND_NEXT_STEPS, MODULE_TASK_COMPARISON 병합 → DEVELOPMENT.md |
