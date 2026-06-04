#!/usr/bin/env npx tsx
/**
 * 우리부고 거래처·공통 안내 템플릿 운영 이전 SQL 생성
 *
 * 출력:
 *   supabase/prod-migration/03_uribugo_clients_and_templates.sql
 *
 * 실행:
 *   npm run generate-clients-sql-dump
 *
 * 필수 env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   MIGRATION_TARGET_SUPABASE_URL (선택 — Storage URL 치환)
 *   URIBUGO_CLIENT_NAMES (선택 — 기본: 현대자동차,(주)제이에스브라더스,기아자동차)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local";
import { generateUribugoClientsTemplatesSql } from "@/lib/prod-sql-seed-clients-templates";

loadEnvLocal();

const REPO_ROOT = process.cwd();
const OUT_DIR = join(REPO_ROOT, "supabase", "prod-migration");
const PARTNER_SUBDOMAIN = process.env.URIBUGO_PARTNER_SUBDOMAIN?.trim() || "wooribugo";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const targetUrl = process.env.MIGRATION_TARGET_SUPABASE_URL?.trim() || null;
  const clientFilter = process.env.URIBUGO_CLIENT_NAMES?.trim()
    ? process.env.URIBUGO_CLIENT_NAMES.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const { sql, summary, storageObjects } = await generateUribugoClientsTemplatesSql({
    partnerSubdomain: PARTNER_SUBDOMAIN,
    targetSupabaseUrl: targetUrl,
    clientNameFilter: clientFilter,
  });

  const outPath = join(OUT_DIR, "03_uribugo_clients_and_templates.sql");
  writeFileSync(outPath, sql, "utf8");
  console.log(`✓ ${outPath}`);

  console.log("\n--- summary ---");
  for (const line of summary) console.log(`  ${line}`);

  if (storageObjects.length) {
    console.log("\n--- storage (SQL URL만 저장 — 파일은 sync-partner-client-assets 실행) ---");
    for (const obj of storageObjects) {
      console.log(`  ${obj.bucket}/${obj.path}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
