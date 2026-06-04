#!/usr/bin/env npx tsx
/**
 * 우리부고 seed에 포함된 Storage 객체(파트너 로고·상품 썸네일)를
 * 소스 Supabase → 운영 Supabase 로 복사합니다.
 *
 * 필수 env (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (소스)
 *   MIGRATION_TARGET_SUPABASE_URL + MIGRATION_TARGET_SERVICE_ROLE_KEY  (대상)
 *
 * 실행:
 *   npm run sync-uribugo-storage-assets
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local";
import { generateUribugoSeedSql } from "@/lib/prod-sql-seed-uribugo";

loadEnvLocal();

const PARTNER_SUBDOMAIN = process.env.URIBUGO_PARTNER_SUBDOMAIN?.trim() || "wooribugo";

function guessContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

async function main() {
  const sourceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const targetUrl = process.env.MIGRATION_TARGET_SUPABASE_URL?.trim();
  const targetKey = process.env.MIGRATION_TARGET_SERVICE_ROLE_KEY?.trim();

  if (!sourceUrl || !sourceKey) {
    throw new Error("소스 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  }
  if (!targetUrl || !targetKey) {
    throw new Error(
      "대상 MIGRATION_TARGET_SUPABASE_URL / MIGRATION_TARGET_SERVICE_ROLE_KEY 필요"
    );
  }

  const { storageObjects } = await generateUribugoSeedSql({
    partnerSubdomain: PARTNER_SUBDOMAIN,
    targetSupabaseUrl: targetUrl,
  });

  if (!storageObjects.length) {
    console.log("복사할 Storage 객체가 없습니다.");
    return;
  }

  const source = createClient(sourceUrl, sourceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const target = createClient(targetUrl, targetKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Storage 복사 ${storageObjects.length}건 → ${targetUrl}`);

  let ok = 0;
  let fail = 0;

  for (const obj of storageObjects) {
    const label = `${obj.bucket}/${obj.path}`;
    try {
      const { data, error } = await source.storage.from(obj.bucket).download(obj.path);
      if (error || !data) {
        throw new Error(error?.message ?? "download failed");
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      const { error: uploadErr } = await target.storage.from(obj.bucket).upload(obj.path, buffer, {
        upsert: true,
        contentType: guessContentType(obj.path),
      });
      if (uploadErr) throw new Error(uploadErr.message);

      ok++;
      console.log(`✓ ${label}`);
    } catch (err) {
      fail++;
      console.error(
        `✗ ${label}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(`\n완료: 성공 ${ok}건, 실패 ${fail}건`);
  if (fail) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
