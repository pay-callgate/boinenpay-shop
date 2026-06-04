#!/usr/bin/env npx tsx
/**
 * 뉴런 스펙 기준 products 일괄 등록·수정 (newrun_default_product_draft 포함)
 *
 * 실행 (dry-run 기본):
 *   npx tsx scripts/upsert-neuron-products.ts
 *   npx tsx scripts/upsert-neuron-products.ts --apply
 *   npx tsx scripts/upsert-neuron-products.ts --apply --partner-subdomain=wooribugo
 */
import { loadEnvLocal } from "./load-env-local";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  NEURON_PRODUCT_SPECS,
  buildNeuronProductDraft,
  type NeuronProductSpec,
} from "@/lib/neuron-product-catalog";
import {
  fetchFloristProducts,
  findProductForSpec,
  resolvePartnerId,
  type DbProductRow,
} from "@/lib/neuron-product-sync-db";

loadEnvLocal();

const DEFAULT_DELIVERY_METHODS = ["quick"];

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function buildInsertPayload(partnerId: string, spec: NeuronProductSpec) {
  const slug =
    spec.slug ??
    `neuron-${spec.neuronCode}-${spec.menuName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-가-힣]/g, "")}`;

  return {
    partner_id: partnerId,
    name: spec.menuName,
    slug,
    short_description: spec.menuName,
    description_html: `<p>${spec.menuName}</p>`,
    thumbnail_url: null,
    base_price: spec.consumerPrice,
    sale_price: spec.consumerPrice,
    member_price: null,
    stock_qty: 999,
    safety_stock: 10,
    status: "active",
    sticker_options: null,
    delivery_methods: DEFAULT_DELIVERY_METHODS,
    allow_delivery_date: true,
    policy_source: "category_default",
    newrun_default_product_draft: buildNeuronProductDraft(spec),
    newrun_default_option_draft: {},
  };
}

function buildUpdatePayload(spec: NeuronProductSpec) {
  return {
    sale_price: spec.consumerPrice,
    base_price: spec.consumerPrice,
    newrun_default_product_draft: buildNeuronProductDraft(spec),
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const apply = hasFlag("apply");
  const partnerIdArg = parseArg("partner-id");
  const partnerSubdomain = parseArg("partner-subdomain");

  const supabase = createServerSupabase();
  const partnerId = await resolvePartnerId(supabase, {
    partnerId: partnerIdArg,
    partnerSubdomain,
  });

  const products = await fetchFloristProducts(supabase, partnerId);

  const plan: {
    action: "insert" | "update" | "skip";
    spec: NeuronProductSpec;
    product?: DbProductRow;
    reason?: string;
  }[] = [];

  for (const spec of NEURON_PRODUCT_SPECS) {
    const existing = findProductForSpec(spec, products);
    if (!existing) {
      plan.push({ action: "insert", spec });
      continue;
    }

    const draft = existing.newrun_default_product_draft ?? {};
    const needsUpdate =
      Number(existing.sale_price) !== spec.consumerPrice ||
      String(draft.rw_menucode ?? "") !== spec.neuronCode ||
      String(draft.rw_price ?? "") !== String(spec.vendorOrderPrice);

    plan.push({
      action: needsUpdate ? "update" : "skip",
      spec,
      product: existing,
      reason: needsUpdate ? undefined : "이미 스펙과 일치",
    });
  }

  console.log(`\n=== 뉴런 상품 Upsert ${apply ? "(APPLY)" : "(DRY-RUN)"} ===`);
  console.log(`파트너 ID: ${partnerId}\n`);
  console.table(
    plan.map((p) => ({
      action: p.action,
      code: p.spec.neuronCode,
      menu: p.spec.menuName,
      target: p.product?.name ?? "(신규)",
      sale: p.spec.consumerPrice,
      vendor: p.spec.vendorOrderPrice,
      note: p.reason ?? "-",
    }))
  );

  if (!apply) {
    console.log("\n실제 반영: npx tsx scripts/upsert-neuron-products.ts --apply");
    return;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of plan) {
    if (row.action === "skip") {
      skipped += 1;
      continue;
    }

    if (row.action === "insert") {
      const payload = buildInsertPayload(partnerId, row.spec);
      const { error } = await supabase.from("products").insert(payload);
      if (error) {
        throw new Error(`insert 실패 [${row.spec.menuName}]: ${error.message}`);
      }
      inserted += 1;
      continue;
    }

    const { error } = await supabase
      .from("products")
      .update(buildUpdatePayload(row.spec))
      .eq("id", row.product!.id);

    if (error) {
      throw new Error(`update 실패 [${row.spec.menuName}]: ${error.message}`);
    }
    updated += 1;
  }

  console.log(`\n완료 — insert ${inserted}, update ${updated}, skip ${skipped}`);
  console.log("대사 재확인: npx tsx scripts/check-product-sync.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
