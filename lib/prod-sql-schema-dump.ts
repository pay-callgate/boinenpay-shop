import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";

export function loadMigrationSql(repoRoot: string): string {
  const dir = join(repoRoot, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql.txt"))
    .sort();

  const parts = [
    "-- =============================================================================",
    "-- CallLink ShoppingMaster — Schema (from supabase/migrations/*.sql.txt)",
    "-- =============================================================================",
    "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";",
    "",
  ];

  for (const file of files) {
    parts.push(`-- ---------- migration: ${file} ----------`);
    parts.push(readFileSync(join(dir, file), "utf8").trim());
    parts.push("");
  }

  return sanitizeMigrationSql(parts.join("\n"));
}

/**
 * COMMENT ON COLUMN 이 CREATE/ALTER 로 정의되지 않은 컬럼을 가리키면 제거 (신규 DB 부트스트랩 실패 방지)
 */
export function sanitizeMigrationSql(sql: string): string {
  const tableColumns = collectTableColumns(sql);
  const lines = sql.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const commentMatch = line.match(
      /^\s*COMMENT ON COLUMN (?:public\.)?(\w+)\.(\w+)\s/i
    );
    if (commentMatch) {
      const table = commentMatch[1].toLowerCase();
      const column = commentMatch[2].toLowerCase();
      const defined = tableColumns.get(table)?.has(column);
      if (!defined) {
        kept.push(
          `-- [SANITIZED] removed orphan COMMENT ON COLUMN ${table}.${column} (column not in CREATE/ALTER)`
        );
        continue;
      }
    }
    kept.push(line);
  }

  return kept.join("\n");
}

function collectTableColumns(sql: string): Map<string, Set<string>> {
  const tableColumns = new Map<string, Set<string>>();

  const addColumn = (table: string, column: string) => {
    const key = table.toLowerCase();
    const col = column.toLowerCase();
    if (!tableColumns.has(key)) tableColumns.set(key, new Set());
    tableColumns.get(key)!.add(col);
  };

  const createTableRe =
    /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
  for (const match of sql.matchAll(createTableRe)) {
    const table = match[1];
    for (const line of match[2].split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("--")) continue;
      const colMatch = trimmed.match(/^(\w+)\s+/);
      if (!colMatch) continue;
      const token = colMatch[1].toUpperCase();
      if (["CONSTRAINT", "PRIMARY", "UNIQUE", "CHECK", "FOREIGN"].includes(token)) {
        continue;
      }
      addColumn(table, colMatch[1]);
    }
  }

  const alterBlockRe =
    /ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(?:public\.)?(\w+)\s+([\s\S]*?);/gi;
  for (const match of sql.matchAll(alterBlockRe)) {
    const table = match[1];
    const body = match[2];
    for (const addMatch of body.matchAll(/ADD COLUMN (?:IF NOT EXISTS )?(\w+)/gi)) {
      addColumn(table, addMatch[1]);
    }
  }

  return tableColumns;
}

export async function dumpLiveDbExtras(client: pg.Client): Promise<string> {
  const sections: string[] = [
    "",
    "-- =============================================================================",
    "-- Live DB extras: RLS · Policies · Functions · Triggers (pg_catalog dump)",
    "-- =============================================================================",
    "",
  ];

  const { rows: rlsTables } = await client.query<{ relname: string }>(`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
    ORDER BY c.relname
  `);

  for (const { relname } of rlsTables) {
    sections.push(`ALTER TABLE public.${quoteIdent(relname)} ENABLE ROW LEVEL SECURITY;`);
  }
  if (rlsTables.length) sections.push("");

  const { rows: policies } = await client.query<{
    schemaname: string;
    tablename: string;
    policyname: string;
    permissive: string;
    roles: string[];
    cmd: string;
    qual: string | null;
    with_check: string | null;
  }>(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
    ORDER BY schemaname, tablename, policyname
  `);

  for (const p of policies) {
    const permissive = p.permissive === "PERMISSIVE" ? "PERMISSIVE" : "RESTRICTIVE";
    const roles = p.roles?.length ? p.roles.map(quoteIdent).join(", ") : "PUBLIC";
    const cmd = p.cmd === "*" ? "ALL" : p.cmd;
    let stmt = `CREATE POLICY ${quoteIdent(p.policyname)} ON ${quoteIdent(p.schemaname)}.${quoteIdent(p.tablename)} AS ${permissive} FOR ${cmd} TO ${roles}`;
    if (p.qual) stmt += ` USING (${p.qual})`;
    if (p.with_check) stmt += ` WITH CHECK (${p.with_check})`;
    stmt += ";";
    sections.push(stmt);
  }
  if (policies.length) sections.push("");

  const { rows: functions } = await client.query<{ def: string }>(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname, p.oid
  `);

  for (const f of functions) {
    sections.push(f.def.trim() + ";");
    sections.push("");
  }

  const { rows: triggers } = await client.query<{ def: string }>(`
    SELECT pg_get_triggerdef(t.oid, true) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname
  `);

  for (const t of triggers) {
    sections.push(t.def.trim() + ";");
    sections.push("");
  }

  return sections.join("\n");
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
