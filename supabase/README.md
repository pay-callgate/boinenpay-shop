# Supabase 마이그레이션 및 시딩

## 마이그레이션 파일

- `migrations/` 폴더의 `.sql.txt` 파일은 ERD 기준 스키마입니다.
- **Supabase CLI 사용 시**: 각 파일을 `.sql` 확장자로 복사한 뒤 `supabase db push` 또는 `supabase migration up` 실행.
- **Supabase 대시보드 사용 시**: SQL Editor에서 `20260210000001_*` → `20260210000002_*` → `20260210000003_*` 순서로 내용 붙여넣어 실행.

## 시딩

- `seed/seed_initial_partner.sql.txt`: 초기 파트너(예: subdomain `yenmidang`) 생성용. 로컬/테스트에서 사용.
- 동일하게 `.sql`로 복사해 SQL Editor에서 실행하거나, Supabase seed 스크립트로 등록 후 실행.

## 참고

- 프로젝트 루트 `.cursorignore`에 `*.sql`이 있어 마이그레이션은 `.sql.txt`로 커밋되어 있습니다. 배포 전 필요한 경우 `.sql`로 복사해 사용하세요.
