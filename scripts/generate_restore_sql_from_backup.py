"""
calllink_backup.sql (UTF-16 LE pg_dump)에서 상품·카테고리 관련 5개 테이블만 추출해 SQL 생성.

대상: product_categories, products, product_category_mappings, product_images, product_options

출력은 INSERT 문만 사용합니다. (Supabase SQL Editor는 COPY ... FROM stdin 미지원)

사용: python scripts/generate_restore_sql_from_backup.py [백업경로]
출력: supabase/seed/restore_calllink_backup_products_only.sql
"""
from __future__ import annotations

import re
import sys
from collections.abc import Callable
from pathlib import Path

DEFAULT_BACKUP = Path(r"c:\pgsql\calllink_backup.sql")
OUT = Path(__file__).resolve().parent.parent / "supabase" / "seed" / "restore_calllink_backup_products_only.sql"

PREAMBLE = r"""-- =============================================================================
-- CallLink 백업 복구 (상품·카테고리만) — INSERT 형식
-- 대상: product_categories, products, product_category_mappings,
--       product_images, product_options
-- 생성: scripts/generate_restore_sql_from_backup.py
--
-- Supabase「SQL Editor」는 pg_dump의 COPY ... FROM stdin; 을 실행할 수 없습니다.
-- 그래서 이 파일은 대시보드에서 그대로 실행 가능한 INSERT 로만 구성했습니다.
--
-- 전제:
--   - public.partners 에 행에 쓰이는 partner_id 가 이미 존재해야 합니다 (FK).
--
-- 실행 예:
--   Supabase → SQL → 전체 붙여넣기 후 Run
--   또는: psql $DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/seed/restore_calllink_backup_products_only.sql
--
-- (선택) 재적재 전 비우기 — BEGIN; 직전 주석 해제
-- TRUNCATE TABLE
--   public.product_options,
--   public.product_images,
--   public.product_category_mappings,
--   public.products,
--   public.product_categories
-- CASCADE;
-- =============================================================================

BEGIN;

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS mobile_visible BOOLEAN NOT NULL DEFAULT true;

"""


def read_backup(path: Path) -> str:
    return path.read_text(encoding="utf-16-le")


def extract_copy(text: str, table: str) -> tuple[str, str] | None:
    pat = rf"^COPY public\.{re.escape(table)} \(([^)]+)\) FROM stdin;\s*\n(.*?)\n\\.\n"
    m = re.search(pat, text, re.MULTILINE | re.DOTALL)
    if not m:
        return None
    return m.group(1), m.group(2).rstrip("\n")


def sort_product_category_data(data: str) -> str:
    """parent_id NULL → 부모가 이미 앞에 온 행 순으로 정렬 (self-FK 안전)."""
    lines = [ln for ln in data.splitlines() if ln.strip()]
    if not lines:
        return data

    parsed: list[tuple[str, str | None, str]] = []
    for ln in lines:
        parts = ln.split("\t")
        if len(parts) < 3:
            continue
        rid, _partner, parent_raw = parts[0], parts[1], parts[2]
        parent = None if parent_raw in ("\\N", "") else parent_raw
        parsed.append((rid, parent, ln))

    ids_done: set[str] = set()
    ordered_lines: list[str] = []
    remaining = list(parsed)
    while remaining:
        ready = [r for r in remaining if r[1] is None or r[1] in ids_done]
        if not ready:
            ordered_lines.extend(r[2] for r in remaining)
            break
        for rid, _p, ln in ready:
            ordered_lines.append(ln)
            ids_done.add(rid)
            remaining = [r for r in remaining if r[0] != rid]

    return "\n".join(ordered_lines)


# ---- COPY 필드 → SQL 리터럴 -------------------------------------------------

NULL_MARK = "\\N"


def _n(s: str) -> bool:
    return s == NULL_MARK or s == ""


def lit_uuid(s: str) -> str:
    return "NULL" if _n(s) else f"'{s}'::uuid"


def lit_text(s: str) -> str:
    if _n(s):
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def lit_text_nn(s: str) -> str:
    """NOT NULL 텍스트 (빈 문자열 허용)."""
    if s == NULL_MARK:
        return "''"
    return "'" + s.replace("'", "''") + "'"


def lit_int(s: str) -> str:
    if _n(s):
        return "NULL"
    return str(int(s))


def lit_decimal(s: str) -> str:
    if _n(s):
        return "NULL"
    return s


def lit_bool(s: str) -> str:
    if _n(s):
        return "NULL"
    return "true" if s == "t" else "false"


def lit_ts(s: str) -> str:
    if _n(s):
        return "NULL"
    return f"'{s}'::timestamptz"


def lit_jsonb(s: str) -> str:
    if _n(s):
        return "NULL"
    return "'" + s.replace("'", "''") + "'::jsonb"


def lit_jsonb_nn(s: str) -> str:
    if _n(s):
        return "'[]'::jsonb"
    return "'" + s.replace("'", "''") + "'::jsonb"


def lit_product_status(s: str) -> str:
    if _n(s):
        return "NULL"
    return f"'{s}'::public.product_status"


RowFmt = Callable[[str], str]


def split_ascii_slug_suffix(s: str) -> tuple[str, str]:
    """한글 이름 뒤에 영문 slug가 붙은 경우(예: 꽃다발bouquet) 분리."""
    s = s.strip()
    for i in range(len(s) - 1, -1, -1):
        if s[i].isascii() and (s[i].isalnum() or s[i] in "-_"):
            continue
        j = i + 1
        while j < len(s) and (s[j].isalnum() or s[j] in "-_"):
            j += 1
        slug = s[i + 1 : j]
        if slug and slug[0].isalpha() and len(slug) >= 2:
            return s[: i + 1].strip(), slug
        break
    return s, ""


def fallback_slug_from_name_or_id(name: str, row_id: str) -> str:
    ascii_slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name.lower()).strip("-")[:100]
    if ascii_slug:
        return ascii_slug
    return "p-" + row_id.replace("-", "")[:16]


def normalize_product_row(parts: list[str]) -> list[str] | None:
    """백업 일부 행에서 name/slug/short_description 칸이 붙거나 slug만 빠짐."""
    n = len(parts)
    if n == 20:
        return parts
    if n == 19:
        return parts[:3] + [""] + parts[3:]
    if n == 18:
        fat = parts[2].strip()
        if fat.endswith("\\N"):
            fat = fat[:-2].rstrip()
        m = re.match(r"^(.+?)\s+([a-zA-Z][a-zA-Z0-9_-]*)$", fat)
        if m:
            name, slug = m.group(1).strip(), m.group(2).strip()
        else:
            name, slug = split_ascii_slug_suffix(fat)
            if not slug:
                name, slug = fat, ""
        if not slug:
            slug = fallback_slug_from_name_or_id(name, parts[0])
        short = NULL_MARK
        return [parts[0], parts[1], name, slug, short] + parts[3:]
    return None


def normalize_category_row(parts: list[str]) -> list[str] | None:
    if len(parts) == 9:
        return parts
    if len(parts) == 8:
        if parts[4].strip().isdigit():
            raw = parts[3]
            msp = re.match(r"^(.+?)\s+([a-zA-Z][a-zA-Z0-9 _-]*)$", raw.strip())
            if msp:
                name, slug = msp.group(1).strip(), msp.group(2).strip().replace(" ", "-")
            else:
                name, slug = split_ascii_slug_suffix(raw)
                if not slug:
                    name, slug = raw, ""
            if not slug:
                slug = fallback_slug_from_name_or_id(name, parts[0])
            return parts[:3] + [name, slug] + parts[4:]
        mnum = re.match(r"^(.+?)(\d+)$", parts[4].strip())
        if mnum and len(mnum.group(2)) <= 4:
            name = parts[3]
            slug = mnum.group(1).strip()
            sort_ord = mnum.group(2)
            return parts[:3] + [name, slug, sort_ord] + parts[5:]
        raw = parts[3]
        msp = re.match(r"^(.+?)\s+([a-zA-Z][a-zA-Z0-9 _-]*)$", raw.strip())
        if msp:
            name, slug = msp.group(1).strip(), msp.group(2).strip().replace(" ", "-")
        else:
            name, slug = split_ascii_slug_suffix(raw)
            if not slug:
                name, slug = raw, ""
        if not slug:
            slug = fallback_slug_from_name_or_id(name, parts[0])
        return parts[:3] + [name, slug] + parts[4:]
    return None


def format_insert(table: str, cols_csv: str, data: str, formatters: list[RowFmt]) -> str:
    col_list = ", ".join(c.strip() for c in cols_csv.split(","))
    lines = [ln for ln in data.splitlines() if ln.strip()]
    if not lines:
        return f"-- (no rows) {table}\n"

    value_rows: list[str] = []
    for i, ln in enumerate(lines):
        parts = ln.split("\t")
        if table == "products":
            fixed = normalize_product_row(parts)
        elif table == "product_categories":
            fixed = normalize_category_row(parts)
        else:
            fixed = parts
        if fixed is None:
            print(f"warn: {table} line {i + 1}: unsupported field count {len(parts)}, skip", file=sys.stderr)
            continue
        if len(fixed) != len(formatters):
            print(
                f"warn: {table} line {i + 1}: after normalize {len(fixed)} != {len(formatters)}, skip",
                file=sys.stderr,
            )
            continue
        cells = [fmt(p) for fmt, p in zip(formatters, fixed, strict=True)]
        value_rows.append("  (" + ", ".join(cells) + ")")

    if not value_rows:
        return f"-- (no valid rows) {table}\n"

    return (
        f"INSERT INTO public.{table} ({col_list})\nVALUES\n"
        + ",\n".join(value_rows)
        + ";\n"
    )


# 컬럼 순서는 백업 COPY 헤더와 동일해야 함
FORMATTERS: dict[str, list[RowFmt]] = {
    "product_categories": [
        lit_uuid,
        lit_uuid,
        lit_uuid,
        lit_text_nn,
        lit_text_nn,
        lit_int,
        lit_ts,
        lit_ts,
        lit_bool,
    ],
    "products": [
        lit_uuid,
        lit_uuid,
        lit_text_nn,
        lit_text_nn,
        lit_text_nn,
        lit_text,
        lit_text,
        lit_decimal,
        lit_decimal,
        lit_int,
        lit_int,
        lit_product_status,
        lit_jsonb,
        lit_jsonb_nn,
        lit_bool,
        lit_ts,
        lit_ts,
        lit_decimal,
        lit_jsonb,
        lit_jsonb,
    ],
    "product_category_mappings": [lit_uuid, lit_uuid],
    "product_images": [
        lit_uuid,
        lit_uuid,
        lit_text_nn,
        lit_int,
        lit_ts,
        lit_ts,
    ],
    "product_options": [
        lit_uuid,
        lit_uuid,
        lit_text_nn,
        lit_text_nn,
        lit_decimal,
        lit_int,
        lit_ts,
        lit_ts,
    ],
}

# parent_id: COPY 에서 \N 이면 lit_uuid 가 NULL 처리 — 위에서 lit_uuid는 _n 이면 NULL.
# product_categories parent_id 는 nullable 이므로 lit_uuid OK (빈 문자열도 NULL).


ORDER = [
    "product_categories",
    "products",
    "product_category_mappings",
    "product_images",
    "product_options",
]


def main() -> None:
    backup_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_BACKUP
    if not backup_path.is_file():
        print(f"백업 파일 없음: {backup_path}", file=sys.stderr)
        sys.exit(1)

    text = read_backup(backup_path)
    chunks: list[str] = [PREAMBLE]

    for table in ORDER:
        got = extract_copy(text, table)
        if not got:
            print(f"skip (없음): {table}", file=sys.stderr)
            continue
        cols, data = got
        if table == "product_categories":
            data = sort_product_category_data(data)
        fmts = FORMATTERS[table]
        chunks.append(f"-- ---------- {table} ----------\n")
        chunks.append(format_insert(table, cols, data, fmts))
        chunks.append("\n")

    chunks.append("COMMIT;\n")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(chunks), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
