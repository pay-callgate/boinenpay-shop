#!/usr/bin/env npx tsx
/**
 * 뉴런 우리부고 상품 스펙 ↔ DB products O/X 대사
 *
 * 실행:
 *   npx tsx scripts/check-product-sync.ts
 *   npx tsx scripts/check-product-sync.ts --partner-subdomain=wooribugo
 *   npx tsx scripts/check-product-sync.ts --partner-id=<uuid>
 */
import { loadEnvLocal } from "./load-env-local";
import { createServerSupabase } from "@/lib/supabase/server";
import { NEURON_PRODUCT_SPECS } from "@/lib/neuron-product-catalog";
import {
  buildProductSyncReport,
  fetchFloristProducts,
  resolvePartnerId,
} from "@/lib/neuron-product-sync-db";

loadEnvLocal();

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

async function main() {
  const partnerIdArg = parseArg("partner-id");
  const partnerSubdomain = parseArg("partner-subdomain");

  const supabase = createServerSupabase();
  const partnerId = await resolvePartnerId(supabase, {
    partnerId: partnerIdArg,
    partnerSubdomain,
  });

  const products = await fetchFloristProducts(supabase, partnerId);
  const rows = buildProductSyncReport(products);

  const ok = rows.filter((r) => r.status === "정상").length;
  const missing = rows.filter((r) => r.status === "누락").length;
  const mismatch = rows.filter((r) => r.status === "불일치").length;

  console.log("\n=== 뉴런 상품 DB 대사 (O/X) ===");
  console.log(`파트너 ID: ${partnerId}`);
  console.log(`스펙 ${NEURON_PRODUCT_SPECS.length}건 · DB 화훼류 ${products.length}건`);
  console.log(`정상 ${ok} · 누락 ${missing} · 불일치 ${mismatch}\n`);

  console.table(
    rows.map((r) => ({
      "매칭": r.matched,
      "코드": r.neuronCode,
      "메뉴명(스펙)": r.menuName,
      "DB상품명": r.dbProductName ?? "-",
      "소비자가(DB/스펙)": r.consumerCompare,
      "발주가(DB/스펙)": r.vendorCompare,
      "상태": r.status,
      "이슈": r.issues.join(" | ") || "-",
    }))
  );

  const extraDb = products.filter(
    (p) => !rows.some((r) => r.dbProductId === p.id && r.status !== "누락")
  );
  if (extraDb.length > 0) {
    console.log("\n--- 스펙에 없는 DB 화훼 상품 (참고) ---");
    console.table(
      extraDb.map((p) => ({
        id: p.id.slice(0, 8) + "…",
        name: p.name,
        sale_price: p.sale_price,
        slug: p.slug,
        categories: p.categories.join(", ") || "-",
      }))
    );
  }

  if (missing > 0 || mismatch > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
