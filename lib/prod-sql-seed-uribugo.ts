import { createServerSupabase } from "@/lib/supabase/server";
import {
  NEURON_PRODUCT_SPECS,
  buildNeuronProductDraft,
  specMatchesProductName,
  type NeuronProductSpec,
} from "@/lib/neuron-product-catalog";
import {
  collectStorageObjectsFromUrls,
  rewriteSupabasePublicUrl,
  type ParsedStorageObject,
} from "@/lib/prod-storage-url";
import {
  deterministicCategoryId,
  deterministicProductId,
  sqlBoolean,
  sqlJsonb,
  sqlNumber,
  sqlString,
  sqlTimestamptz,
} from "@/lib/prod-sql-format";

const PARTNER_SEED_COLUMNS = [
  "id",
  "subdomain",
  "business_registration_number",
  "company_name",
  "representative",
  "postcode",
  "address",
  "business_type",
  "contact",
  "fax",
  "business_category",
  "email",
  "trade_categories",
  "verification_status",
  "verified_at",
  "created_at",
  "updated_at",
  "franchise_name",
  "corporate_registration_number",
  "representative_dob",
  "owner_id",
  "logo_url",
] as const;

const CATEGORY_NAME_FILTER = ["축하화환", "근조화환"] as const;
const DEFAULT_DELIVERY_METHODS = ["same_day", "quick"];

type DbProductRow = Record<string, unknown> & {
  id: string;
  name: string;
  slug: string;
};

type DbCategoryRow = {
  id: string;
  partner_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
};

type DbPartnerRow = Record<string, unknown> & {
  id: string;
  subdomain: string;
  company_name: string;
};

type DbMappingRow = {
  product_id: string;
  category_id: string;
  is_primary?: boolean;
};

function inferCategorySlug(spec: NeuronProductSpec): "chukha-wreath" | "geunjo-wreath" {
  const n = spec.menuName;
  if (n.startsWith("축하") || n.includes("축하")) return "chukha-wreath";
  return "geunjo-wreath";
}

function inferCategoryName(spec: NeuronProductSpec): "축하화환" | "근조화환" {
  return inferCategorySlug(spec) === "chukha-wreath" ? "축하화환" : "근조화환";
}

function rewriteUrl(
  url: string | null | undefined,
  targetSupabaseUrl?: string | null
): string | null {
  return rewriteSupabasePublicUrl(url, targetSupabaseUrl);
}

function mergeProductRow(
  spec: NeuronProductSpec,
  db: DbProductRow | null,
  partnerId: string,
  targetSupabaseUrl?: string | null
) {
  const draft = buildNeuronProductDraft(spec);
  const id = db?.id ? String(db.id) : deterministicProductId(spec.neuronCode);

  return {
    id,
    partner_id: partnerId,
    name: spec.menuName,
    slug: db?.slug ? String(db.slug) : spec.slug ?? `neuron-${spec.neuronCode}`,
    short_description: db?.short_description ? String(db.short_description) : spec.menuName,
    description_html: db?.description_html ?? null,
    thumbnail_url: rewriteUrl(
      db?.thumbnail_url ? String(db.thumbnail_url) : null,
      targetSupabaseUrl
    ),
    base_price: spec.consumerPrice,
    sale_price: spec.consumerPrice,
    member_price: db?.member_price ?? null,
    stock_qty: db?.stock_qty != null ? Number(db.stock_qty) : 999,
    safety_stock: db?.safety_stock != null ? Number(db.safety_stock) : 10,
    status: db?.status ? String(db.status) : "active",
    sticker_options: db?.sticker_options ?? null,
    delivery_methods: db?.delivery_methods ?? DEFAULT_DELIVERY_METHODS,
    allow_delivery_date: db?.allow_delivery_date ?? true,
    policy_source: db?.policy_source ?? "category_default",
    override_template_id: db?.override_template_id ?? null,
    custom_policy_data: db?.custom_policy_data ?? null,
    newrun_default_product_draft: draft,
    newrun_default_option_draft: db?.newrun_default_option_draft ?? {},
    created_at: db?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function productInsertSql(row: ReturnType<typeof mergeProductRow>): string {
  const cols = [
    "id",
    "partner_id",
    "name",
    "slug",
    "short_description",
    "description_html",
    "thumbnail_url",
    "base_price",
    "sale_price",
    "member_price",
    "stock_qty",
    "safety_stock",
    "status",
    "sticker_options",
    "delivery_methods",
    "allow_delivery_date",
    "policy_source",
    "override_template_id",
    "custom_policy_data",
    "newrun_default_product_draft",
    "newrun_default_option_draft",
    "created_at",
    "updated_at",
  ];

  const vals = [
    sqlString(row.id),
    sqlString(row.partner_id),
    sqlString(row.name),
    sqlString(row.slug),
    sqlString(row.short_description),
    row.description_html ? sqlString(String(row.description_html)) : "NULL",
    row.thumbnail_url ? sqlString(String(row.thumbnail_url)) : "NULL",
    sqlNumber(row.base_price),
    sqlNumber(row.sale_price),
    row.member_price != null ? sqlNumber(Number(row.member_price)) : "NULL",
    sqlNumber(row.stock_qty),
    sqlNumber(row.safety_stock),
    sqlString(String(row.status)),
    row.sticker_options ? sqlJsonb(row.sticker_options) : "NULL",
    sqlJsonb(
      Array.isArray(row.delivery_methods)
        ? row.delivery_methods
        : DEFAULT_DELIVERY_METHODS
    ),
    sqlBoolean(Boolean(row.allow_delivery_date)),
    sqlString(String(row.policy_source)),
    row.override_template_id ? sqlString(String(row.override_template_id)) : "NULL",
    row.custom_policy_data ? sqlJsonb(row.custom_policy_data) : "NULL",
    sqlJsonb(row.newrun_default_product_draft),
    sqlJsonb(row.newrun_default_option_draft ?? {}),
    sqlTimestamptz(String(row.created_at)),
    sqlTimestamptz(String(row.updated_at)),
  ];

  return `INSERT INTO public.products (${cols.join(", ")})\nVALUES (${vals.join(", ")})\nON CONFLICT (id) DO UPDATE SET\n  name = EXCLUDED.name,\n  sale_price = EXCLUDED.sale_price,\n  base_price = EXCLUDED.base_price,\n  newrun_default_product_draft = EXCLUDED.newrun_default_product_draft,\n  updated_at = EXCLUDED.updated_at;`;
}

function categoryInsertSql(row: DbCategoryRow): string {
  return `INSERT INTO public.product_categories (id, partner_id, parent_id, name, slug, sort_order, created_at, updated_at)
VALUES (
  ${sqlString(row.id)},
  ${sqlString(row.partner_id)},
  ${row.parent_id ? sqlString(row.parent_id) : "NULL"},
  ${sqlString(row.name)},
  ${sqlString(row.slug)},
  ${sqlNumber(row.sort_order)},
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;`;
}

function partnerInsertSql(row: DbPartnerRow, targetSupabaseUrl?: string | null): string {
  const normalized: Record<string, unknown> = { ...row };
  if (normalized.logo_url != null) {
    normalized.logo_url = rewriteUrl(String(normalized.logo_url), targetSupabaseUrl);
  }
  if (
    normalized.trade_categories === "" ||
    normalized.trade_categories == null
  ) {
    normalized.trade_categories = null;
  }

  const cols = PARTNER_SEED_COLUMNS.filter((k) => normalized[k] !== undefined);
  const vals = cols.map((k) => {
    const v = normalized[k];
    if (v == null) return "NULL";
    if (k === "trade_categories") return sqlJsonb(v);
    if (typeof v === "boolean") return sqlBoolean(v);
    if (typeof v === "number") return sqlNumber(v);
    if (v instanceof Date) return sqlTimestamptz(v);
    return sqlString(String(v));
  });
  return `INSERT INTO public.partners (${cols.join(", ")})
VALUES (${vals.join(", ")})
ON CONFLICT (id) DO UPDATE SET
  logo_url = EXCLUDED.logo_url,
  updated_at = EXCLUDED.updated_at;`;
}

export async function generateUribugoSeedSql(opts: {
  partnerSubdomain: string;
  targetSupabaseUrl?: string | null;
}): Promise<{ sql: string; summary: string[]; storageObjects: ParsedStorageObject[] }> {
  const summary: string[] = [];
  const supabase = createServerSupabase();

  const { data: partner, error: partnerErr } = await supabase
    .from("partners")
    .select("*")
    .eq("subdomain", opts.partnerSubdomain)
    .maybeSingle();

  if (partnerErr || !partner) {
    throw new Error(
      `partners.subdomain='${opts.partnerSubdomain}' 조회 실패: ${partnerErr?.message ?? "not found"}`
    );
  }

  const partnerId = String(partner.id);
  summary.push(`partner: ${partner.subdomain} (${partnerId})`);

  const { data: dbProducts, error: prodErr } = await supabase
    .from("products")
    .select("*")
    .eq("partner_id", partnerId);

  if (prodErr) throw new Error(`products 조회 실패: ${prodErr.message}`);

  const products = (dbProducts ?? []) as DbProductRow[];
  const matchedSpecs: { spec: NeuronProductSpec; db: DbProductRow | null }[] = [];

  for (const spec of NEURON_PRODUCT_SPECS) {
    const db =
      products.find((p) => {
        const draft = p.newrun_default_product_draft as Record<string, unknown> | null;
        const code = draft?.rw_menucode ?? draft?.neuron_code;
        if (code != null && String(code).trim() === spec.neuronCode) return true;
        return specMatchesProductName(spec, String(p.name));
      }) ?? null;
    matchedSpecs.push({ spec, db });
  }

  summary.push(
    `products spec: ${NEURON_PRODUCT_SPECS.length}건 (DB 매칭 ${matchedSpecs.filter((m) => m.db).length}건)`
  );

  const productRows = matchedSpecs.map(({ spec, db }) => ({
    spec,
    row: mergeProductRow(spec, db, partnerId, opts.targetSupabaseUrl),
  }));
  const productIds = productRows.map((p) => p.row.id);

  const { data: dbCategories, error: catErr } = await supabase
    .from("product_categories")
    .select("*")
    .eq("partner_id", partnerId);

  if (catErr) throw new Error(`product_categories 조회 실패: ${catErr.message}`);

  const categories = (dbCategories ?? []) as DbCategoryRow[];

  let dbMappings: DbMappingRow[] = [];
  if (productIds.length) {
    const { data: maps, error: mapErr } = await supabase
      .from("product_category_mappings")
      .select("product_id, category_id, is_primary")
      .in("product_id", productIds);
    if (mapErr) throw new Error(`product_category_mappings 조회 실패: ${mapErr.message}`);
    dbMappings = (maps ?? []) as DbMappingRow[];
  }

  const categoryIdsFromDb = new Set(dbMappings.map((m) => m.category_id));
  const categoriesByName = new Map(categories.map((c) => [c.name, c]));
  const categoryRows: DbCategoryRow[] = [];

  for (const name of CATEGORY_NAME_FILTER) {
    const existing = categoriesByName.get(name);
    if (existing) {
      categoryRows.push(existing);
      continue;
    }
    const slug = name === "축하화환" ? "chukha-wreath" : "geunjo-wreath";
    categoryRows.push({
      id: deterministicCategoryId(slug),
      partner_id: partnerId,
      parent_id: null,
      name,
      slug,
      sort_order: name === "축하화환" ? 1 : 2,
    });
  }

  for (const catId of categoryIdsFromDb) {
    const c = categories.find((x) => x.id === catId);
    if (c && !categoryRows.some((r) => r.id === c.id)) {
      categoryRows.push(c);
    }
  }

  const categoryBySlug = new Map(categoryRows.map((c) => [c.slug, c]));
  const mappingRows: DbMappingRow[] = [];

  for (const { spec, row: product } of productRows) {
    const existing = dbMappings.find((m) => m.product_id === product.id);
    if (existing) {
      mappingRows.push(existing);
      continue;
    }
    const catSlug = inferCategorySlug(spec);
    const cat =
      categoryBySlug.get(catSlug) ??
      categoryRows.find((c) => c.name === inferCategoryName(spec));
    if (cat) {
      mappingRows.push({
        product_id: product.id,
        category_id: cat.id,
        is_primary: true,
      });
    }
  }

  let dbImages: Record<string, unknown>[] = [];
  if (productIds.length) {
    const { data: images } = await supabase
      .from("product_images")
      .select("id, product_id, url, sort_order, created_at, updated_at")
      .in("product_id", productIds);
    dbImages = images ?? [];
  }

  const imageUrls: string[] = [];

  if (partner.logo_url) {
    imageUrls.push(String(partner.logo_url));
  }
  for (const { row } of productRows) {
    if (row.thumbnail_url) imageUrls.push(String(row.thumbnail_url));
  }

  const parts: string[] = [
    "-- =============================================================================",
    "-- CallLink ShoppingMaster — 우리부고(Uribugo) 운영 Seed",
    "-- 트랜잭션(orders/carts 등) · 스펙 외 테스트 상품 제외",
    `-- 생성 시각: ${new Date().toISOString()}`,
    opts.targetSupabaseUrl
      ? `-- Storage URL 대상: ${opts.targetSupabaseUrl}`
      : "-- Storage URL: 소스 프로젝트 그대로 (MIGRATION_TARGET_SUPABASE_URL 미설정)",
    "-- =============================================================================",
    "BEGIN;",
    "",
    "-- seed prerequisites (구버전 01_schema 적용 후에도 안전)",
    "ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);",
    "",
    "-- partners (wooribugo)",
    partnerInsertSql(partner as DbPartnerRow, opts.targetSupabaseUrl),
    "",
    "-- product_categories",
  ];

  for (const c of categoryRows) {
    parts.push(categoryInsertSql(c));
  }

  parts.push("", "-- products (neuron spec 22건 + 발주 draft 강제 주입)");
  for (const { row: p } of productRows) {
    parts.push(productInsertSql(p));
    parts.push("");
  }

  if (mappingRows.length) {
    parts.push("-- product_category_mappings");
    for (const m of mappingRows) {
      parts.push(
        `INSERT INTO public.product_category_mappings (product_id, category_id, is_primary)
VALUES (${sqlString(m.product_id)}, ${sqlString(m.category_id)}, ${sqlBoolean(Boolean(m.is_primary))})
ON CONFLICT (product_id, category_id) DO NOTHING;`
      );
    }
    parts.push("");
  }

  if (dbImages.length) {
    parts.push("-- product_images (스펙 상품에 한정)");
    for (const img of dbImages) {
      const url = rewriteUrl(String(img.url), opts.targetSupabaseUrl);
      imageUrls.push(url ?? String(img.url));
      parts.push(
        `INSERT INTO public.product_images (id, product_id, url, sort_order, created_at, updated_at)
VALUES (
  ${sqlString(String(img.id))},
  ${sqlString(String(img.product_id))},
  ${url ? sqlString(url) : "NULL"},
  ${sqlNumber(Number(img.sort_order))},
  ${sqlTimestamptz(String(img.created_at))},
  ${sqlTimestamptz(String(img.updated_at))}
)
ON CONFLICT (id) DO NOTHING;`
      );
    }
    parts.push("");
  }

  const storageObjects = collectStorageObjectsFromUrls(imageUrls);

  parts.push("COMMIT;", "");
  parts.push("-- 검증:");
  parts.push(`-- SELECT count(*) FROM products WHERE partner_id = '${partnerId}';`);

  summary.push(`categories: ${categoryRows.length}건`);
  summary.push(`mappings: ${mappingRows.length}건`);
  summary.push(`images: ${dbImages.length}건`);
  summary.push(`storage objects: ${storageObjects.length}건`);

  return { sql: parts.join("\n"), summary, storageObjects };
}
