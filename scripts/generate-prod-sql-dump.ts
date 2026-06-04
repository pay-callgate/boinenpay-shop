#!/usr/bin/env npx tsx
/**
 * 운영 Supabase 이전용 SQL 파일 생성
 *
 * 출력:
 *   supabase/prod-migration/01_schema_and_policies.sql
 *   supabase/prod-migration/02_uribugo_seed_data.sql
 *
 * 실행:
 *   npm run generate-prod-sql-dump
 *
 * 필수 env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (seed 추출)
 *   DATABASE_URL (선택) — RLS/Policy/Function/Trigger live dump
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local";
import { loadMigrationSql, dumpLiveDbExtras } from "@/lib/prod-sql-schema-dump";
import { generateUribugoSeedSql } from "@/lib/prod-sql-seed-uribugo";

loadEnvLocal();

const REPO_ROOT = process.cwd();
const OUT_DIR = join(REPO_ROOT, "supabase", "prod-migration");
const PARTNER_SUBDOMAIN = process.env.URIBUGO_PARTNER_SUBDOMAIN?.trim() || "wooribugo";

async function tryDumpLiveExtras(): Promise<string> {
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.POSTGRES_URL?.trim();

  if (!databaseUrl) {
    return [
      "",
      "-- [SKIP] DATABASE_URL 미설정 — RLS/Policy/Function/Trigger live dump 생략",
      "-- Supabase Dashboard → Database → Connection string 을 .env.local DATABASE_URL 에 추가 후 재실행",
      "",
    ].join("\n");
  }

  try {
    const pg = await import("pg");
    const client = new pg.default.Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
    await client.connect();
    const extras = await dumpLiveDbExtras(client);
    await client.end();
    return extras;
  } catch (err) {
    return [
      "",
      "-- [WARN] live DB extras dump 실패:",
      `-- ${err instanceof Error ? err.message : String(err)}`,
      "",
    ].join("\n");
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const schemaPath = join(OUT_DIR, "01_schema_and_policies.sql");
  const schemaSql = [loadMigrationSql(REPO_ROOT), await tryDumpLiveExtras()].join("\n");
  writeFileSync(schemaPath, schemaSql, "utf8");
  console.log(`✓ ${schemaPath}`);

  const { sql: seedSql, summary } = await generateUribugoSeedSql({
    partnerSubdomain: PARTNER_SUBDOMAIN,
  });
  const seedPath = join(OUT_DIR, "02_uribugo_seed_data.sql");
  writeFileSync(seedPath, seedSql, "utf8");
  console.log(`✓ ${seedPath}`);

  console.log("\n--- seed summary ---");
  for (const line of summary) console.log(`  ${line}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
