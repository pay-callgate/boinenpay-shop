import { describe, expect, it } from "vitest";
import {
  NEURON_PRODUCT_SPECS,
  buildNeuronProductDraft,
  readNeuronDraftFields,
  specMatchesProductName,
} from "@/lib/neuron-product-catalog";
import { buildProductSyncReport, type DbProductRow } from "@/lib/neuron-product-sync-db";

describe("neuron-product-catalog", () => {
  it("스펙 건수는 기타(10) 제외 22건", () => {
    expect(NEURON_PRODUCT_SPECS.length).toBe(22);
    expect(NEURON_PRODUCT_SPECS.some((s) => s.neuronCode === "10")).toBe(false);
  });

  it("별칭으로 테스트 DB 상품명 매칭", () => {
    const spec = NEURON_PRODUCT_SPECS.find((s) => s.neuronCode === "44")!;
    expect(specMatchesProductName(spec, "축하화환(특)")).toBe(true);
  });

  it("draft 빌더는 rw_menucode·rw_price 포함", () => {
    const spec = NEURON_PRODUCT_SPECS.find((s) => s.neuronCode === "91")!;
    const draft = buildNeuronProductDraft(spec);
    expect(draft.rw_menucode).toBe("91");
    expect(draft.rw_price).toBe("80000");
    const parsed = readNeuronDraftFields(draft);
    expect(parsed.neuronCode).toBe("91");
    expect(parsed.vendorOrderPrice).toBe(80_000);
  });
});

describe("buildProductSyncReport", () => {
  it("코드·가격 일치 시 정상", () => {
    const spec = NEURON_PRODUCT_SPECS.find((s) => s.neuronCode === "44")!;
    const products: DbProductRow[] = [
      {
        id: "p1",
        name: "축하화환(특)",
        slug: "chukha-special",
        sale_price: spec.consumerPrice,
        base_price: spec.consumerPrice,
        status: "active",
        newrun_default_product_draft: buildNeuronProductDraft(spec),
        categories: ["축하화환"],
      },
    ];
    const row = buildProductSyncReport(products).find((r) => r.neuronCode === "44")!;
    expect(row.status).toBe("정상");
    expect(row.matched).toBe("O");
  });

  it("발주가 누락 시 불일치", () => {
    const spec = NEURON_PRODUCT_SPECS.find((s) => s.neuronCode === "44")!;
    const products: DbProductRow[] = [
      {
        id: "p1",
        name: "축하화환(특)",
        slug: "chukha-special",
        sale_price: 200,
        base_price: 200,
        status: "active",
        newrun_default_product_draft: { rw_menucode: "44" },
        categories: ["축하화환"],
      },
    ];
    const row = buildProductSyncReport(products).find((r) => r.neuronCode === "44")!;
    expect(row.status).toBe("불일치");
    expect(row.matched).toBe("X");
  });
});
