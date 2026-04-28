import { describe, expect, it } from "vitest";
import { mapOrderToNewrunPayload } from "@/lib/newrun/map-order-to-newrun-payload";

describe("mapOrderToNewrunPayload (본부발주 head)", () => {
  it("rw_type·rw_method·rw_sno(주문 id)·rw_bdate YYYY-MM-DD·수주화원/상품코드 없이 strict 통과", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "11111111-1111-1111-1111-111111111111",
        order_no: "ORD-1",
        payment_status: "paid",
        total_amount: 90000,
        shipping_name: "홍길동",
        shipping_phone: "010-1234-5678",
        shipping_postcode: "04524",
        shipping_address: "서울특별시 중구",
        shipping_detail: "101호",
        created_at: "2026-03-31T12:00:00.000Z",
        desired_delivery_date: "2026-04-28",
      },
      [{ quantity: 1, product_name: "화환" }],
      { florist: null, product: null, option: null },
      {
        rw_rosewebid: "call0000",
        rw_rosewebpw: "secret",
        rw_assoc: "call0000",
        rw_returnurl: "https://www.example.com/wooribugo/wooribu/newrun/po-return",
      },
      {
        strict: true,
        headquartersBonbalju: true,
        rw_method: "1",
      }
    );

    expect(r.fields.rw_type).toBe("head");
    expect(r.fields.rw_method).toBe("1");
    expect(r.fields.rw_sender).toBe("100");
    expect(r.fields.rw_rosewebid).toBe("call0000");
    expect(r.fields.rw_sno).toBe("11111111-1111-1111-1111-111111111111");
    expect(r.fields.rw_bdate).toBe("2026-04-28");
    expect(r.fields.rw_price).toBe("90000");
  });

  it("희망배송일 없으면 created_at 기준 YYYY-MM-DD", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "22222222-2222-2222-2222-222222222222",
        order_no: "ORD-2",
        payment_status: "paid",
        total_amount: 1000,
        shipping_name: "甲",
        shipping_phone: "01000000000",
        shipping_address: "주소",
        created_at: "2026-05-15T03:00:00.000Z",
        desired_delivery_date: null,
      },
      [],
      { florist: null, product: null, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_returnurl: "https://x/po-return",
      },
      { strict: true, headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_bdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
