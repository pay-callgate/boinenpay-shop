import { describe, expect, it } from "vitest";
import {
  mapNewrunDeliveryStateToOrderStatus,
  mergeNewrunDeliveryParams,
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
});
