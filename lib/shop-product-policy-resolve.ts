import type { SupabaseClient } from "@supabase/supabase-js";

export type ProductPolicySourceDb = "category_default" | "template" | "custom";

export type PolicyTabBlocks = {
  delivery_info: string;
  refund_policy: string;
  product_notice: string;
};

/** Shop API 노출용 */
export type ResolvedProductPolicyTab = PolicyTabBlocks & {
  source: "custom" | "template" | "category_default" | "empty";
  template_id: string | null;
};

type CategoryNode = {
  parent_id: string | null;
  default_template_id: string | null;
};

export type ShopProductCategoryMappingRow = {
  created_at: string | null;
  is_primary: boolean | null;
  category: {
    id: string;
    parent_id: string | null;
    default_template_id: string | null;
    name: string;
    slug: string;
  } | null;
};

type MappingInput = ShopProductCategoryMappingRow;

function parseCustomPolicyData(raw: unknown): PolicyTabBlocks | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    delivery_info: s("delivery_info"),
    refund_policy: s("refund_policy"),
    product_notice: s("product_notice"),
  };
}

/** 루트부터의 깊이(루트=0, 직계 자식=1) */
function categoryDepth(categoryId: string, idToNode: Map<string, CategoryNode>): number {
  let d = 0;
  let cur: string | null = categoryId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = idToNode.get(cur);
    if (!node?.parent_id) break;
    d += 1;
    cur = node.parent_id;
  }
  return d;
}

/**
 * partner 범위에서 seedId 및 모든 조상 category row를 로드해 id -> node 맵 구성
 */
async function loadCategoryClosure(
  supabase: SupabaseClient,
  partnerId: string,
  seedIds: string[]
): Promise<Map<string, CategoryNode>> {
  const map = new Map<string, CategoryNode>();
  let frontier = [...new Set(seedIds.filter(Boolean))];
  while (frontier.length > 0) {
    const ids = frontier.filter((id) => !map.has(id));
    if (ids.length === 0) break;
    const { data, error } = await supabase
      .from("product_categories")
      .select("id, parent_id, default_template_id")
      .eq("partner_id", partnerId)
      .in("id", ids);
    if (error || !data?.length) break;
    const nextParents: string[] = [];
    for (const row of data as {
      id: string;
      parent_id: string | null;
      default_template_id: string | null;
    }[]) {
      map.set(row.id, {
        parent_id: row.parent_id,
        default_template_id: row.default_template_id,
      });
      if (row.parent_id && !map.has(row.parent_id)) {
        nextParents.push(row.parent_id);
      }
    }
    frontier = nextParents;
  }
  return map;
}

/**
 * 가장 깊은 depth → is_primary true 우선 → created_at 오름차순.
 * 각 후보의 default_template_id가 있으면 해당 템플릿 ID 반환.
 */
function resolveTemplateIdFromCategoryMappings(
  mappings: MappingInput[] | null | undefined,
  idToNode: Map<string, CategoryNode>
): string | null {
  if (!mappings?.length) return null;

  const scored = mappings
    .filter((m) => m.category?.id)
    .map((m) => {
      const cid = m.category!.id;
      const depth = categoryDepth(cid, idToNode);
      const templateId = m.category!.default_template_id;
      const created = m.created_at ? new Date(m.created_at).getTime() : 0;
      const primary = Boolean(m.is_primary);
      return { cid, depth, templateId, created, primary };
    })
    .sort((a, b) => {
      if (b.depth !== a.depth) return b.depth - a.depth;
      if (a.primary !== b.primary) return (b.primary ? 1 : 0) - (a.primary ? 1 : 0);
      return a.created - b.created;
    });

  for (const row of scored) {
    if (row.templateId) return row.templateId;
  }
  return null;
}

async function fetchInfoTemplateById(
  supabase: SupabaseClient,
  partnerId: string,
  templateId: string
): Promise<PolicyTabBlocks & { id: string } | null> {
  const { data, error } = await supabase
    .from("info_templates")
    .select("id, delivery_info, refund_policy, product_notice")
    .eq("partner_id", partnerId)
    .eq("id", templateId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: String(data.id),
    delivery_info: (data.delivery_info as string) ?? "",
    refund_policy: (data.refund_policy as string) ?? "",
    product_notice: (data.product_notice as string) ?? "",
  };
}

export type ProductPolicyInput = {
  partner_id: string;
  policy_source: ProductPolicySourceDb | null;
  override_template_id: string | null;
  custom_policy_data: unknown;
  product_category_mappings?: MappingInput[] | null;
};

/**
 * Shop PDP 탭2용 정책 블록 resolve.
 * - custom: custom_policy_data JSON 3키
 * - template: override_template_id → info_templates
 * - category_default: 매핑 카테고리 깊이/is_primary/created_at 우선으로 default_template_id 선택 → info_templates
 * - template 실패 시 category_default로 폴백
 */
export async function resolveShopProductPolicyTab(
  supabase: SupabaseClient,
  product: ProductPolicyInput
): Promise<ResolvedProductPolicyTab> {
  const empty = (): ResolvedProductPolicyTab => ({
    delivery_info: "",
    refund_policy: "",
    product_notice: "",
    source: "empty",
    template_id: null,
  });

  const source = product.policy_source ?? "category_default";

  if (source === "custom") {
    const parsed = parseCustomPolicyData(product.custom_policy_data);
    if (parsed) {
      return {
        ...parsed,
        source: "custom",
        template_id: null,
      };
    }
    return empty();
  }

  if (source === "template" && product.override_template_id) {
    const row = await fetchInfoTemplateById(
      supabase,
      product.partner_id,
      product.override_template_id
    );
    if (row) {
      return {
        delivery_info: row.delivery_info,
        refund_policy: row.refund_policy,
        product_notice: row.product_notice,
        source: "template",
        template_id: row.id,
      };
    }
  }

  const seedIds =
    product.product_category_mappings
      ?.map((m) => m.category?.id)
      .filter((id): id is string => Boolean(id)) ?? [];
  const idToNode = await loadCategoryClosure(supabase, product.partner_id, seedIds);
  const categoryTemplateId = resolveTemplateIdFromCategoryMappings(
    product.product_category_mappings,
    idToNode
  );

  if (!categoryTemplateId) {
    return empty();
  }

  const row = await fetchInfoTemplateById(supabase, product.partner_id, categoryTemplateId);
  if (!row) {
    return empty();
  }

  return {
    delivery_info: row.delivery_info,
    refund_policy: row.refund_policy,
    product_notice: row.product_notice,
    source: "category_default",
    template_id: row.id,
  };
}
