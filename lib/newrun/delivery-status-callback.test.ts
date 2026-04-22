import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapNewrunDeliveryStateToOrderStatus,
  mergeNewrunDeliveryParams,
  processNewrunDeliveryCallback,
} from "@/lib/newrun/delivery-status-callback";

describe("delivery-status-callback", () => {
  it("state 2/3/4 매핑", () => {
    expect(mapNewrunDeliveryStateToOrderStatus("2")).toBe("confirmed");
    expect(mapNewrunDeliveryStateToOrderStatus("3")).toBe("shipping");
    expect(mapNewrunDeliveryStateToOrderStatus("4")).toBe("delivered");
    expect(mapNewrunDeliveryStateToOrderStatus("99")).toBeNull();
  });

  it("쿼리·본문 병합, 소문자 키", () => {
    expect(
      mergeNewrunDeliveryParams(
        { OID: "A1", STATE: "3" },
        { state: "4", DICA: "http://x" }
      )
    ).toEqual({
      oid: "A1",
      state: "4",
      dica: "http://x",
    });
  });

  it("배송 콜백: 주문 상태 변경 시·유지 시 모두 order_status_history 기록", async () => {
    const historyRows: { order_id: string; status: string; memo: string }[] = [];

    const mkSupabase = (orderStatus: string) =>
      ({
        from(table: string) {
          if (table === "orders") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "o-1",
                      status: orderStatus,
                      newrun_delivery_info: {},
                    },
                    error: null,
                  }),
                }),
              }),
              update: () => ({
                eq: async () => ({ error: null }),
              }),
            };
          }
          if (table === "order_status_history") {
            return {
              insert: (row: { order_id: string; status: string; memo: string | null }) => {
                historyRows.push({
                  order_id: row.order_id,
                  status: row.status,
                  memo: row.memo ?? "",
                });
                return Promise.resolve({ error: null });
              },
            };
          }
          throw new Error(`unexpected table: ${table}`);
        },
      }) as unknown as SupabaseClient;

    historyRows.length = 0;
    const r1 = await processNewrunDeliveryCallback(mkSupabase("received"), {
      oid: "ORD-X",
      state: "2",
    });
    expect(r1.ok).toBe(true);
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].status).toBe("confirmed");
    expect(historyRows[0].memo).toContain("뉴런 배송상태 업데이트");

    historyRows.length = 0;
    const r2 = await processNewrunDeliveryCallback(mkSupabase("confirmed"), {
      oid: "ORD-X",
      state: "2",
    });
    expect(r2.ok).toBe(true);
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0].status).toBe("confirmed");
    expect(historyRows[0].memo).toContain("주문 상태 변경 없음");
  });
});
