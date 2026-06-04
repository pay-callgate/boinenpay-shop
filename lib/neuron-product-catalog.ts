/**
 * 뉴런 우리부고 원청 상품 스펙 (협의 완료).
 * - menuName / consumerPrice: 쇼핑몰 노출·고객 결제
 * - neuronCode / vendorOrderPrice: intranet_post 발주 (rw_menucode / rw_price)
 */
export type NeuronProductSpec = {
  /** 뉴런 코드명 (rw_menucode) */
  neuronCode: string;
  /** 쇼핑몰 메뉴명 */
  menuName: string;
  /** 소비자가(원) — products.sale_price */
  consumerPrice: number;
  /** 화훼금액·발주가(원) — newrun_default_product_draft.rw_price */
  vendorOrderPrice: number;
  /** DB 상품명이 스펙과 다를 때 추가 매칭용 */
  aliases?: string[];
  /** upsert 시 slug 기본값 */
  slug?: string;
};

/** 사용여부 O — 기타(10) 제외 */
export const NEURON_PRODUCT_SPECS: NeuronProductSpec[] = [
  { neuronCode: "39", menuName: "근조3단", consumerPrice: 100_000, vendorOrderPrice: 50_000, slug: "geunjo-3dan" },
  { neuronCode: "35", menuName: "축하3단", consumerPrice: 100_000, vendorOrderPrice: 50_000, slug: "chukha-3dan" },
  { neuronCode: "09", menuName: "근조화환(기본형)", consumerPrice: 100_000, vendorOrderPrice: 50_000, slug: "geunjo-wreath-basic" },
  { neuronCode: "08", menuName: "축하화환(기본형)", consumerPrice: 100_000, vendorOrderPrice: 50_000, slug: "chukha-wreath-basic" },
  {
    neuronCode: "43",
    menuName: "근조화환(특)",
    consumerPrice: 120_000,
    vendorOrderPrice: 70_000,
    slug: "geunjo-wreath-special",
    aliases: ["근조화환(특)", "근조화환 (특)"],
  },
  {
    neuronCode: "44",
    menuName: "축하화환(특)",
    consumerPrice: 120_000,
    vendorOrderPrice: 70_000,
    slug: "chukha-wreath-special",
    aliases: ["축하화환(특)", "축하화환 (특)"],
  },
  { neuronCode: "45", menuName: "근조화환(특대)", consumerPrice: 130_000, vendorOrderPrice: 80_000, slug: "geunjo-wreath-xl" },
  { neuronCode: "46", menuName: "축하화환(특대)", consumerPrice: 130_000, vendorOrderPrice: 80_000, slug: "chukha-wreath-xl" },
  {
    neuronCode: "41",
    menuName: "근조바구니",
    consumerPrice: 90_000,
    vendorOrderPrice: 50_000,
    slug: "geunjo-basket",
    aliases: ["근조바구니(특)", "근조바구니 (특)"],
  },
  { neuronCode: "51", menuName: "오브제1단", consumerPrice: 120_000, vendorOrderPrice: 60_000, slug: "objet-1dan-51" },
  { neuronCode: "48", menuName: "오브제2단", consumerPrice: 150_000, vendorOrderPrice: 80_000, slug: "objet-2dan-48" },
  { neuronCode: "42", menuName: "근조4단", consumerPrice: 150_000, vendorOrderPrice: 90_000, slug: "geunjo-4dan" },
  { neuronCode: "37", menuName: "축하4단", consumerPrice: 150_000, vendorOrderPrice: 90_000, slug: "chukha-4dan" },
  {
    neuronCode: "91",
    menuName: "근조쌀화환10kg",
    consumerPrice: 100_000,
    vendorOrderPrice: 80_000,
    slug: "geunjo-rice-wreath-10kg",
    aliases: ["근조쌀화환10KG"],
  },
  {
    neuronCode: "92",
    menuName: "축하쌀화환10kg",
    consumerPrice: 100_000,
    vendorOrderPrice: 80_000,
    slug: "chukha-rice-wreath-10kg",
    aliases: ["축하쌀화환10KG"],
  },
  {
    neuronCode: "93",
    menuName: "근조쌀화환20KG",
    consumerPrice: 130_000,
    vendorOrderPrice: 100_000,
    slug: "geunjo-rice-wreath-20kg",
    aliases: ["근조쌀화환20kg"],
  },
  {
    neuronCode: "94",
    menuName: "축하쌀화환20kg",
    consumerPrice: 130_000,
    vendorOrderPrice: 100_000,
    slug: "chukha-rice-wreath-20kg",
    aliases: ["축하쌀화환20KG"],
  },
  { neuronCode: "49", menuName: "근조5단", consumerPrice: 250_000, vendorOrderPrice: 150_000, slug: "geunjo-5dan" },
  { neuronCode: "38", menuName: "축하5단", consumerPrice: 250_000, vendorOrderPrice: 150_000, slug: "chukha-5dan" },
  { neuronCode: "47", menuName: "오브제1단", consumerPrice: 120_000, vendorOrderPrice: 60_000, slug: "objet-1dan-47" },
  { neuronCode: "52", menuName: "오브제2단", consumerPrice: 150_000, vendorOrderPrice: 80_000, slug: "objet-2dan-52" },
  {
    neuronCode: "89",
    menuName: "근조(영정)바구니",
    consumerPrice: 90_000,
    vendorOrderPrice: 50_000,
    slug: "geunjo-yeongjeong-basket",
  },
];

export function normalizeProductLabel(name: string): string {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

export function specMatchesProductName(spec: NeuronProductSpec, productName: string): boolean {
  const n = normalizeProductLabel(productName);
  if (normalizeProductLabel(spec.menuName) === n) return true;
  return (spec.aliases ?? []).some((a) => normalizeProductLabel(a) === n);
}

/** newrun_default_product_draft → 발주 코드·발주가 추출 */
export function readNeuronDraftFields(
  draft: Record<string, unknown> | null | undefined
): { neuronCode: string | null; vendorOrderPrice: number | null } {
  if (!draft || typeof draft !== "object") {
    return { neuronCode: null, vendorOrderPrice: null };
  }
  const codeRaw =
    draft.rw_menucode ??
    draft.menucode ??
    draft.var_menucode ??
    draft.neuron_code ??
    null;
  const priceRaw = draft.rw_price ?? draft.neuron_order_price ?? null;

  const neuronCode =
    codeRaw != null && String(codeRaw).trim() !== "" ? String(codeRaw).trim() : null;

  let vendorOrderPrice: number | null = null;
  if (priceRaw != null && String(priceRaw).trim() !== "") {
    const n = Number(String(priceRaw).replace(/,/g, ""));
    vendorOrderPrice = Number.isFinite(n) ? Math.round(n) : null;
  }

  return { neuronCode, vendorOrderPrice };
}

/** upsert 시 저장할 newrun_default_product_draft */
export function buildNeuronProductDraft(spec: NeuronProductSpec): Record<string, string> {
  return {
    rw_menucode: spec.neuronCode,
    rw_price: String(spec.vendorOrderPrice),
    neuron_code: spec.neuronCode,
    neuron_order_price: String(spec.vendorOrderPrice),
  };
}

export function formatWon(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return new Intl.NumberFormat("ko-KR").format(n);
}
