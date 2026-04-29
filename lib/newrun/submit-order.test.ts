import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitNewrunOrder } from "@/lib/newrun/submit-order";

function mockSupabase(args: {
  order: Record<string, unknown>;
  items: unknown[];
  onOrdersUpdate?: (patch: Record<string, unknown>) => void;
  historyRows?: { order_id: string; status: string; memo: string | null }[];
}): SupabaseClient {
  return {
    from(table: string) {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: args.order, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            args.onOrdersUpdate?.(patch);
            return {
              eq: () => Promise.resolve({ error: null }),
            };
          },
        };
      }
      if (table === "order_items") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: args.items, error: null }),
            }),
          }),
        };
      }
      if (table === "order_status_history") {
        return {
          insert: (row: { order_id: string; status: string; memo: string | null }) => {
            args.historyRows?.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

const paidOrderBase = {
  id: "11111111-1111-1111-1111-111111111111",
  payment_status: "paid",
  order_no: "E2E-NR-1",
  total_amount: 15000,
  shipping_name: "테스트",
  shipping_phone: "01012345678",
  shipping_postcode: "04524",
  shipping_address: "서울 중구",
  shipping_detail: "상세",
  created_at: "2026-03-31T12:00:00.000Z",
  client: {
    id: "c1",
    newrun_default_florist_draft: { rw_sujuid: "FL-1" },
  },
  newrun_florist_draft: null,
  newrun_product_draft: { rw_menucode: "PR-1" },
  newrun_option_draft: null,
  newrun_submit_status: null,
  newrun_rwr_result: null,
  status: "received",
};

const orderItems = [
  {
    quantity: 1,
    product_name: "테스트상품",
    product: {
      newrun_default_product_draft: null,
      newrun_default_option_draft: null,
    },
  },
];

describe("submitNewrunOrder", () => {
  const envKeys = [
    "NEWRUN_MOCK",
    "NEWRUN_ENABLED",
    "NEWRUN_MOCK_RWR_RESULT",
    "NEWRUN_ASSOC_INTRANET_ID",
    "NEWRUN_ROSEWEB_ID",
    "NEWRUN_ROSEWEB_PW",
    "NEWRUN_ASSOC_CODE",
    "NEWRUN_RW_RETURNURL",
    "NEWRUN_INTRANET_POST_URL",
  ] as const;

  const prev: Partial<Record<(typeof envKeys)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      prev[k] = process.env[k];
    }
    process.env.NEWRUN_ASSOC_INTRANET_ID = "id";
    process.env.NEWRUN_ROSEWEB_ID = "rose-id";
    process.env.NEWRUN_ROSEWEB_PW = "pw";
    process.env.NEWRUN_ASSOC_CODE = "assoc";
    process.env.NEWRUN_RW_RETURNURL = "https://example.com/newrun/po-return";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("NEWRUN_MOCK=true 이면 외부 호출 없이 success·DB 패치", async () => {
    process.env.NEWRUN_MOCK = "true";
    process.env.NEWRUN_ENABLED = "false";
    process.env.NEWRUN_MOCK_RWR_RESULT = "0";

    let updated: Record<string, unknown> | undefined;
    const historyRows: { order_id: string; status: string; memo: string | null }[] = [];
    const supabase = mockSupabase({
      order: { ...paidOrderBase },
      items: orderItems,
      onOrdersUpdate: (p) => {
        updated = p;
      },
      historyRows,
    });

    const res = await submitNewrunOrder(supabase, paidOrderBase.id as string, {
      source: "viewpay_complete",
    });

    expect(res.ok).toBe(true);
    expect(res.duplicate).toBe(false);
    expect(res.rwr_result).toBe("0");
    expect(res.rwr_orderkey).toBe(`MOCK-${paidOrderBase.order_no}`);
    expect(updated).toMatchObject({
      newrun_submit_status: "success",
      newrun_rwr_result: "0",
      newrun_last_submit_error: null,
    });
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].order_id).toBe(paidOrderBase.id);
    expect(historyRows[0].status).toBe("received");
    expect(historyRows[0].memo).toContain("뉴런 intranet_post");
    expect(historyRows[0].memo).toContain("source=viewpay_complete");
    expect(historyRows[0].memo).toContain("submit=success");
    expect(historyRows[0].memo).toContain("rwr_result=0");
  });

  it("NEWRUN_MOCK=true + 결과 20 → duplicate 상태", async () => {
    process.env.NEWRUN_MOCK = "true";
    process.env.NEWRUN_MOCK_RWR_RESULT = "20";

    let updated: Record<string, unknown> | undefined;
    const historyRows: { order_id: string; status: string; memo: string | null }[] = [];
    const supabase = mockSupabase({
      order: { ...paidOrderBase },
      items: orderItems,
      onOrdersUpdate: (p) => {
        updated = p;
      },
      historyRows,
    });

    const res = await submitNewrunOrder(supabase, paidOrderBase.id as string, {
      source: "admin_manual",
    });

    expect(res.ok).toBe(true);
    expect(res.duplicate).toBe(true);
    expect(updated?.newrun_submit_status).toBe("duplicate");
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].memo).toContain("submit=duplicate");
  });

  it("NEWRUN_MOCK=false + ENABLED=true 이면 fetch 후 HTML 파싱", async () => {
    delete process.env.NEWRUN_MOCK;
    process.env.NEWRUN_ENABLED = "true";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        headers: new Headers(),
        text: async () =>
          '<input name="rwr_result" value="0" /><input name="rwr_orderkey" value="GW-999" />',
      })) as unknown as typeof fetch
    );

    let updated: Record<string, unknown> | undefined;
    const historyRows: { order_id: string; status: string; memo: string | null }[] = [];
    const supabase = mockSupabase({
      order: { ...paidOrderBase },
      items: orderItems,
      onOrdersUpdate: (p) => {
        updated = p;
      },
      historyRows,
    });

    const res = await submitNewrunOrder(supabase, paidOrderBase.id as string, {
      source: "admin_manual",
    });

    expect(res.ok).toBe(true);
    expect(res.rwr_result).toBe("0");
    expect(res.rwr_orderkey).toBe("GW-999");
    expect(updated).toMatchObject({
      newrun_submit_status: "success",
      newrun_rwr_result: "0",
      newrun_rwr_orderkey: "GW-999",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].memo).toContain("rwr_orderkey=GW-999");
  });

  it("미결제 주문은 발주 실패·failed 기록", async () => {
    process.env.NEWRUN_MOCK = "true";

    let updated: Record<string, unknown> | undefined;
    const historyRows: { order_id: string; status: string; memo: string | null }[] = [];
    const supabase = mockSupabase({
      order: { ...paidOrderBase, payment_status: "pending" },
      items: orderItems,
      onOrdersUpdate: (p) => {
        updated = p;
      },
      historyRows,
    });

    const res = await submitNewrunOrder(supabase, paidOrderBase.id as string, {
      source: "admin_manual",
    });

    expect(res.ok).toBe(false);
    expect(updated?.newrun_submit_status).toBe("failed");
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].memo).toContain("submit=failed");
  });
});
