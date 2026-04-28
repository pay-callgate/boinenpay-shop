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
    expect(r.fields.rw_menucode).toBe("35");
  });

  it("리본·장소·주문자 컬럼이 있으면 발주 폼에 ribbonSender, detailPlace, rw_jname 포함", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "33333333-3333-3333-3333-333333333333",
        order_no: "ORD-3",
        payment_status: "paid",
        total_amount: 1,
        shipping_name: "수취",
        shipping_phone: "01000000000",
        shipping_address: "서울",
        shipping_detail: "장소첫줄\n\n[배달 희망] 2026-04-01",
        created_at: "2026-03-31T12:00:00.000Z",
        desired_delivery_date: "2026-04-02",
        orderer_name: "주문자희",
        ribbon_sender: "리본보냄",
        ribbon_message: "축하",
        venue_detail: "DB장소상세",
      },
      [],
      { florist: null, product: { rw_menucode: "SHOULD_BE_OVERRIDDEN" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_returnurl: "https://x/po-return",
      },
      { strict: true, headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_menucode).toBe("35");
    expect(r.fields.detailPlace).toBe("DB장소상세");
    expect(r.fields.ribbonSender).toBe("리본보냄");
    expect(r.fields.ribbonMessage).toBe("축하");
    expect(r.fields.rw_jname).toBe("주문자희");
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
