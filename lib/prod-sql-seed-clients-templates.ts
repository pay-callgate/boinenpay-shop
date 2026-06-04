import { createServerSupabase } from "@/lib/supabase/server";
import {
  collectStorageObjectsFromUrls,
  rewriteSupabasePublicUrl,
  type ParsedStorageObject,
} from "@/lib/prod-storage-url";
import {
  sqlBoolean,
  sqlJsonb,
  sqlNumber,
  sqlString,
  sqlTimestamptz,
} from "@/lib/prod-sql-format";
import { NEURON_PRODUCT_SPECS, specMatchesProductName } from "@/lib/neuron-product-catalog";

const PARTNER_UPSERT_COLUMNS = [
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

const DEFAULT_CLIENT_NAMES = [
  "현대자동차",
  "(주)제이에스브라더스",
  "기아자동차",
] as const;

const CLIENT_COLUMNS = [
  "id",
  "partner_id",
  "slug",
  "name",
  "logo_url",
  "business_registration_number",
  "verification_status",
  "contact_name",
  "contact_phone",
  "contact_email",
  "call_070_connected",
  "newrun_default_florist_draft",
  "created_at",
  "updated_at",
] as const;

const INFO_TEMPLATE_COLUMNS = [
  "id",
  "partner_id",
  "name",
  "delivery_info",
  "refund_policy",
  "product_notice",
  "created_at",
  "updated_at",
] as const;

const CALL_070_COLUMNS = [
  "id",
  "client_id",
  "call_070_number",
  "greeting_message",
  "industry",
  "admin_name",
  "admin_email",
  "admin_phone",
  "sms_text_template",
  "callcloud_registered",
  "created_at",
  "updated_at",
] as const;

type Row = Record<string, unknown>;

function sqlCell(key: string, value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "boolean") return sqlBoolean(value);
  if (typeof value === "number") return sqlNumber(value);
  if (value instanceof Date) return sqlTimestamptz(value);
  if (
    key === "trade_categories" ||
    key === "newrun_default_florist_draft" ||
    key.endsWith("_draft") ||
    key === "custom_policy_data"
  ) {
    return sqlJsonb(value);
  }
  return sqlString(String(value));
}

function insertRowSql(
  table: string,
  columns: readonly string[],
  row: Row,
  conflict: { target: string; updateColumns?: readonly string[] }
): string {
  const cols = columns.filter((c) => row[c] !== undefined);
  const vals = cols.map((c) => sqlCell(c, row[c]));
  let sql = `INSERT INTO public.${table} (${cols.join(", ")})\nVALUES (${vals.join(", ")})\nON CONFLICT (${conflict.target})`;
  if (conflict.updateColumns?.length) {
    const sets = conflict.updateColumns.map((c) => `  ${c} = EXCLUDED.${c}`);
    sql += ` DO UPDATE SET\n${sets.join(",\n")};`;
  } else {
    sql += " DO NOTHING;";
  }
  return sql;
}

function partnerUpsertSql(row: Row, targetSupabaseUrl?: string | null): string {
  const normalized: Row = { ...row };
  if (normalized.logo_url != null) {
    normalized.logo_url = rewriteSupabasePublicUrl(
      String(normalized.logo_url),
      targetSupabaseUrl
    );
  }
  if (normalized.trade_categories === "" || normalized.trade_categories == null) {
    normalized.trade_categories = null;
  }

  const updateCols = PARTNER_UPSERT_COLUMNS.filter(
    (c) => c !== "id" && c !== "created_at"
  );
  return insertRowSql("partners", PARTNER_UPSERT_COLUMNS, normalized, {
    target: "id",
    updateColumns: updateCols,
  });
}

function rewriteLogoUrl(
  url: string | null | undefined,
  targetSupabaseUrl?: string | null
): string | null {
  return rewriteSupabasePublicUrl(url, targetSupabaseUrl);
}

function parseClientNameFilter(raw: string | undefined): string[] {
  if (!raw?.trim()) return [...DEFAULT_CLIENT_NAMES];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchesClientExport(name: string, filters: string[]): boolean {
  const n = name.trim();
  const norm = n.replace(/\s+/g, "").replace(/\(주\)/g, "");
  return filters.some((f) => {
    const ff = f.trim();
    if (n === ff) return true;
    const fn = ff.replace(/\(주\)/g, "").replace(/\s+/g, "");
    return norm.includes(fn) || fn.includes(norm);
  });
}

export async function generateUribugoClientsTemplatesSql(opts: {
  partnerSubdomain: string;
  targetSupabaseUrl?: string | null;
  clientNameFilter?: string[];
}): Promise<{ sql: string; summary: string[]; storageObjects: ParsedStorageObject[] }> {
  const summary: string[] = [];
  const supabase = createServerSupabase();
  const clientFilters =
    opts.clientNameFilter ?? parseClientNameFilter(process.env.URIBUGO_CLIENT_NAMES);

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

  const { data: templates, error: tplErr } = await supabase
    .from("info_templates")
    .select("*")
    .eq("partner_id", partnerId)
    .order("name");

  if (tplErr) throw new Error(`info_templates 조회 실패: ${tplErr.message}`);

  const templateIds = (templates ?? []).map((t) => String(t.id));
  summary.push(`info_templates: ${templateIds.length}건`);

  const { data: allClients, error: clientErr } = await supabase
    .from("clients")
    .select("*")
    .eq("partner_id", partnerId)
    .order("name");

  if (clientErr) throw new Error(`clients 조회 실패: ${clientErr.message}`);

  const clients = (allClients ?? []).filter((c) =>
    matchesClientExport(String(c.name), clientFilters)
  );
  summary.push(`clients: ${clients.length}건 (${clientFilters.join(", ")})`);

  const clientIds = clients.map((c) => String(c.id));

  let call070Rows: Row[] = [];
  if (clientIds.length) {
    const { data: configs, error: cfgErr } = await supabase
      .from("client_call_070_configs")
      .select("*")
      .in("client_id", clientIds);
    if (cfgErr) throw new Error(`client_call_070_configs 조회 실패: ${cfgErr.message}`);
    call070Rows = (configs ?? []) as Row[];
  }
  summary.push(`client_call_070_configs: ${call070Rows.length}건`);

  const { data: neuronProducts } = await supabase
    .from("products")
    .select("id, name, newrun_default_product_draft")
    .eq("partner_id", partnerId);

  const specProductIds = new Set<string>();
  for (const spec of NEURON_PRODUCT_SPECS) {
    const db =
      (neuronProducts ?? []).find((p) => {
        const draft = p.newrun_default_product_draft as Record<string, unknown> | null;
        const code = draft?.rw_menucode ?? draft?.neuron_code;
        if (code != null && String(code).trim() === spec.neuronCode) return true;
        return specMatchesProductName(spec, String(p.name));
      }) ?? null;
    if (db) specProductIds.add(String(db.id));
  }

  let categoryFkUpdates: { id: string; default_template_id: string }[] = [];
  if (templateIds.length) {
    const { data: categories } = await supabase
      .from("product_categories")
      .select("id, default_template_id")
      .eq("partner_id", partnerId)
      .in("default_template_id", templateIds);

    categoryFkUpdates = (categories ?? [])
      .filter((c) => c.default_template_id)
      .map((c) => ({
        id: String(c.id),
        default_template_id: String(c.default_template_id),
      }));
  }

  let productFkUpdates: {
    id: string;
    override_template_id: string;
    policy_source: string;
  }[] = [];
  if (templateIds.length && specProductIds.size) {
    const { data: products } = await supabase
      .from("products")
      .select("id, override_template_id, policy_source")
      .eq("partner_id", partnerId)
      .in("id", [...specProductIds])
      .in("override_template_id", templateIds);

    productFkUpdates = (products ?? [])
      .filter((p) => p.override_template_id)
      .map((p) => ({
        id: String(p.id),
        override_template_id: String(p.override_template_id),
        policy_source: String(p.policy_source ?? "template"),
      }));
  }

  summary.push(`FK category default_template_id: ${categoryFkUpdates.length}건`);
  summary.push(`FK product override_template_id: ${productFkUpdates.length}건`);

  const imageUrls: string[] = [];
  if (partner.logo_url) imageUrls.push(String(partner.logo_url));
  for (const c of clients) {
    if (c.logo_url) imageUrls.push(String(c.logo_url));
  }

  const parts: string[] = [
    "-- =============================================================================",
    "-- CallLink ShoppingMaster — 우리부고(Uribugo) 거래처·공통 안내 템플릿 Seed",
    "-- 트랜잭션(orders/link_kakao_notifications 등) 제외",
    `-- 생성 시각: ${new Date().toISOString()}`,
    opts.targetSupabaseUrl
      ? `-- Storage URL 대상: ${opts.targetSupabaseUrl}`
      : "-- Storage URL: 소스 프로젝트 그대로 (MIGRATION_TARGET_SUPABASE_URL 미설정)",
    "-- 선행: 01_schema → 02_uribugo_seed_data 적용 후 실행",
    "-- =============================================================================",
    "BEGIN;",
    "",
    "-- partners (wooribugo) 최신 정보 upsert",
    partnerUpsertSql(partner as Row, opts.targetSupabaseUrl),
    "",
  ];

  if ((templates ?? []).length) {
    parts.push("-- info_templates (공통 안내 관리)");
    for (const t of templates ?? []) {
      parts.push(
        insertRowSql("info_templates", INFO_TEMPLATE_COLUMNS, t as Row, {
          target: "id",
          updateColumns: [
            "name",
            "delivery_info",
            "refund_policy",
            "product_notice",
            "updated_at",
          ],
        })
      );
      parts.push("");
    }
  }

  if (clients.length) {
    parts.push("-- clients (우리부고 거래처)");
    for (const c of clients) {
      const row: Row = { ...c };
      if (row.logo_url != null) {
        row.logo_url = rewriteLogoUrl(String(row.logo_url), opts.targetSupabaseUrl);
      }
      parts.push(
        insertRowSql("clients", CLIENT_COLUMNS, row, {
          target: "id",
          updateColumns: [
            "slug",
            "name",
            "logo_url",
            "business_registration_number",
            "verification_status",
            "contact_name",
            "contact_phone",
            "contact_email",
            "call_070_connected",
            "newrun_default_florist_draft",
            "updated_at",
          ],
        })
      );
      parts.push("");
    }
  }

  if (call070Rows.length) {
    parts.push("-- client_call_070_configs (070 · CallCloud)");
    for (const cfg of call070Rows) {
      parts.push(
        insertRowSql("client_call_070_configs", CALL_070_COLUMNS, cfg, {
          target: "id",
          updateColumns: [
            "call_070_number",
            "greeting_message",
            "industry",
            "admin_name",
            "admin_email",
            "admin_phone",
            "sms_text_template",
            "callcloud_registered",
            "updated_at",
          ],
        })
      );
      parts.push("");
    }
  }

  if (categoryFkUpdates.length || productFkUpdates.length) {
    parts.push("-- FK 보정 (info_templates INSERT 이후 — 02번 seed 카테고리/상품 연결)");
    for (const c of categoryFkUpdates) {
      parts.push(
        `UPDATE public.product_categories SET default_template_id = ${sqlString(c.default_template_id)}, updated_at = now() WHERE id = ${sqlString(c.id)};`
      );
    }
    for (const p of productFkUpdates) {
      parts.push(
        `UPDATE public.products SET override_template_id = ${sqlString(p.override_template_id)}, policy_source = ${sqlString(p.policy_source)}::product_policy_source, updated_at = now() WHERE id = ${sqlString(p.id)};`
      );
    }
    parts.push("");
  }

  parts.push("COMMIT;", "");
  parts.push("-- 검증:");
  parts.push(`-- SELECT count(*) FROM info_templates WHERE partner_id = '${partnerId}';`);
  parts.push(`-- SELECT name, slug FROM clients WHERE partner_id = '${partnerId}';`);

  const storageObjects = collectStorageObjectsFromUrls(
    imageUrls.map((u) => rewriteSupabasePublicUrl(u, opts.targetSupabaseUrl) ?? u)
  );
  summary.push(`storage objects: ${storageObjects.length}건`);

  return { sql: parts.join("\n"), summary, storageObjects };
}
