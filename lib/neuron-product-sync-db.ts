import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NEURON_PRODUCT_SPECS,
  readNeuronDraftFields,
  specMatchesProductName,
  type NeuronProductSpec,
} from "@/lib/neuron-product-catalog";

export type DbProductRow = {
  id: string;
  name: string;
  slug: string;
  sale_price: number | string | null;
  base_price: number | string | null;
  status: string;
  newrun_default_product_draft: Record<string, unknown> | null;
  categories: string[];
};

export type ProductSyncStatus = "정상" | "누락" | "불일치";

export type ProductSyncReportRow = {
  matched: "O" | "X";
  neuronCode: string;
  menuName: string;
  dbProductId: string | null;
  dbProductName: string | null;
  consumerCompare: string;
  vendorCompare: string;
  status: ProductSyncStatus;
  issues: string[];
};

const FLORAL_CATEGORY_KEYWORDS = ["근조", "축하", "화환", "바구니", "오브제", "쌀화환"];

function toIntPrice(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function resolvePartnerId(
  supabase: SupabaseClient,
  opts: { partnerId?: string; partnerSubdomain?: string }
): Promise<string> {
  if (opts.partnerId?.trim()) return opts.partnerId.trim();

  const subdomain = (opts.partnerSubdomain ?? process.env.NEURON_SYNC_PARTNER_SUBDOMAIN ?? "wooribugo").trim();
  const { data, error } = await supabase
    .from("partners")
    .select("id, subdomain, company_name")
    .eq("subdomain", subdomain)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(`파트너를 찾을 수 없습니다 (subdomain=${subdomain})`);
  }
  return String(data.id);
}

export async function fetchFloristProducts(
  supabase: SupabaseClient,
  partnerId: string
): Promise<DbProductRow[]> {
  const { data: products, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      slug,
      sale_price,
      base_price,
      status,
      newrun_default_product_draft,
      product_category_mappings (
        category:product_categories ( name )
      )
    `
    )
    .eq("partner_id", partnerId);

  if (error) throw new Error(`products 조회 실패: ${error.message}`);

  return (products ?? [])
    .map((p) => {
      const mappings = (p.product_category_mappings ?? []) as {
        category?: { name?: string } | null;
      }[];
      const categories = mappings
        .map((m) => m.category?.name?.trim())
        .filter((n): n is string => Boolean(n));

      return {
        id: String(p.id),
        name: String(p.name),
        slug: String(p.slug),
        sale_price: p.sale_price as number | string | null,
        base_price: p.base_price as number | string | null,
        status: String(p.status),
        newrun_default_product_draft: (p.newrun_default_product_draft ?? null) as Record<
          string,
          unknown
        > | null,
        categories,
      };
    })
    .filter((p) => {
      const inCategory = categoriesMatchFlorist(p.categories);
      const inName = FLORAL_CATEGORY_KEYWORDS.some((k) => p.name.includes(k));
      return inCategory || inName;
    });
}

function categoriesMatchFlorist(categories: string[]): boolean {
  return categories.some((c) =>
    FLORAL_CATEGORY_KEYWORDS.some((k) => c.includes(k))
  );
}

export function findProductForSpec(
  spec: NeuronProductSpec,
  products: DbProductRow[]
): DbProductRow | null {
  const byDraft = products.find((p) => {
    const { neuronCode } = readNeuronDraftFields(p.newrun_default_product_draft);
    return neuronCode === spec.neuronCode;
  });
  if (byDraft) return byDraft;

  const byName = products.filter((p) => specMatchesProductName(spec, p.name));
  if (byName.length === 1) return byName[0]!;
  return null;
}

export function buildProductSyncReport(products: DbProductRow[]): ProductSyncReportRow[] {
  return NEURON_PRODUCT_SPECS.map((spec) => {
    const db = findProductForSpec(spec, products);
    const issues: string[] = [];

    if (!db) {
      return {
        matched: "X",
        neuronCode: spec.neuronCode,
        menuName: spec.menuName,
        dbProductId: null,
        dbProductName: null,
        consumerCompare: `- / ${spec.consumerPrice.toLocaleString("ko-KR")}`,
        vendorCompare: `- / ${spec.vendorOrderPrice.toLocaleString("ko-KR")}`,
        status: "누락",
        issues: ["DB에 매칭 상품 없음"],
      };
    }

    const sale = toIntPrice(db.sale_price);
    const draft = readNeuronDraftFields(db.newrun_default_product_draft);

    if (sale !== spec.consumerPrice) {
      issues.push(`소비자가 불일치 (DB ${sale ?? "-"} vs 스펙 ${spec.consumerPrice})`);
    }
    if (!draft.neuronCode) {
      issues.push("발주 코드(rw_menucode) 누락");
    } else if (draft.neuronCode !== spec.neuronCode) {
      issues.push(`발주 코드 불일치 (DB ${draft.neuronCode} vs 스펙 ${spec.neuronCode})`);
    }
    if (draft.vendorOrderPrice == null) {
      issues.push("발주가(rw_price) 누락");
    } else if (draft.vendorOrderPrice !== spec.vendorOrderPrice) {
      issues.push(
        `발주가 불일치 (DB ${draft.vendorOrderPrice} vs 스펙 ${spec.vendorOrderPrice})`
      );
    }

    const status: ProductSyncStatus = issues.length === 0 ? "정상" : "불일치";

    return {
      matched: status === "정상" ? "O" : "X",
      neuronCode: spec.neuronCode,
      menuName: spec.menuName,
      dbProductId: db.id,
      dbProductName: db.name,
      consumerCompare: `${sale?.toLocaleString("ko-KR") ?? "-"} / ${spec.consumerPrice.toLocaleString("ko-KR")}`,
      vendorCompare: `${draft.vendorOrderPrice?.toLocaleString("ko-KR") ?? "-"} / ${spec.vendorOrderPrice.toLocaleString("ko-KR")}`,
      status,
      issues,
    };
  });
}
