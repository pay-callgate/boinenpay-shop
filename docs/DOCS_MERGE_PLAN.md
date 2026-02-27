# docs 폴더 병합 계획 (카테고리별 1~2개 유지)

**작성:** 2026-02-10  
**목적:** admin, Test, development, implementation 카테고리별 1~2개 파일만 남기고 나머지 병합.

---

## 병합 매핑

### Admin (3 → 1)
| 유지 파일 | 병합 소스 (삭제 예정) |
|-----------|------------------------|
| **ADMIN_GUIDE.md** | PARTNER_ADMIN_ACCESS_CHECKLIST.md, PARTNER_REGISTRATION_FIX_GUIDE.md, MOBILE_SHOP_LOGIN_FIX.md |

### Test (3 → 1)
| 유지 파일 | 병합 소스 (삭제 예정) |
|-----------|------------------------|
| **TEST.md** | TEST_PLAN.md, TEST_READINESS_REVIEW.md, TEST_CHECKLIST.md |

### Development (9 → 2)
| 유지 파일 | 병합 소스 (삭제 예정) |
|-----------|------------------------|
| **DEVELOPMENT.md** | DEVELOPMENT_PLAN.md, DEVELOPMENT_PROGRESS.md, IMPLEMENTATION_PLAN.md, IMPLEMENTATION_REVIEW_AND_NEXT_STEPS.md, MODULE_TASK_COMPARISON.md |
| **AUDIT.md** | DOCS_REVIEW.md, FLOW_AUDIT_REPORT.md, ARCHITECTURE_DIAGRAM.md, SUPABASE_SCHEMA_AUDIT.md |

### Implementation (4 → 2)
| 유지 파일 | 병합 소스 (삭제 예정) |
|-----------|------------------------|
| **IMPLEMENTATION_070.md** | CALLCLOUD_070_AUTOMATION_SPEC.md, CALLCLOUD_070_ERROR_ANALYSIS.md, CALLCLOUD_070_UI_UPDATE_PLAN.md |
| **IMPLEMENTATION_AUTH_AND_ERRORS.md** | NEXTAUTH_CLIENT_FETCH_ERROR_ANALYSIS.md |

### 변경 없음 (핵심 참조)
- PRD.md, TRD.md, ERD.md, API_SPEC.md, PAGE_STRUCTURE_FLOW.md

---

## 병합 후 docs 목록 (완료)

| 카테고리 | 파일 | 비고 |
|----------|------|------|
| Admin | ADMIN_GUIDE.md | 1개 |
| Test | TEST.md | 1개 |
| Development | DEVELOPMENT.md, AUDIT.md | 2개 |
| Implementation | IMPLEMENTATION_070.md, IMPLEMENTATION_AUTH_AND_ERRORS.md | 2개 |
| 참조(유지) | PRD.md, TRD.md, ERD.md, API_SPEC.md, PAGE_STRUCTURE_FLOW.md | 변경 없음 |
| 계획 | DOCS_MERGE_PLAN.md | 본 문서 |

**완료 일시:** 2026-02-10 — 병합 소스 파일 삭제 완료.
