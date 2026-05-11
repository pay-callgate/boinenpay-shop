import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  INTRANET_POST_RW_KEYS,
  isIntranetPostRwKey,
} from "@/lib/newrun/intranet-post-field-template";
import { mapOrderToNewrunPayload } from "@/lib/newrun/map-order-to-newrun-payload";

describe("mapOrderToNewrunPayload (본부발주 head)", () => {
  const prev: { rose?: string; ret?: string } = {};

  beforeEach(() => {
    prev.rose = process.env.NEWRUN_ROSEWEB_ID;
    prev.ret = process.env.NEWRUN_RW_RETURNURL;
    process.env.NEWRUN_ROSEWEB_ID = "rose-web-id";
    process.env.NEWRUN_RW_RETURNURL = "https://www.example.com/wooribugo/wooribu/newrun/po-return";
  });

  afterEach(() => {
    if (prev.rose === undefined) delete process.env.NEWRUN_ROSEWEB_ID;
    else process.env.NEWRUN_ROSEWEB_ID = prev.rose;
    if (prev.ret === undefined) delete process.env.NEWRUN_RW_RETURNURL;
    else process.env.NEWRUN_RW_RETURNURL = prev.ret;
  });

  it("rw_type·rw_method·rw_sno(주문 id)·rw_bdate YYYY-MM-DD·본부발주 시 draft 의 rw_menucode·수주화원(rw_sujuid) 필수", () => {
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
        created_at: "2026-04-31T12:00:00.000Z",
        desired_delivery_date: "2026-04-28",
        delivery_time_slot: "14:00~16:00",
      },
      [{ quantity: 1, product_name: "화환" }],
      { florist: { rw_sujuid: "SJ-1", var_sid: "SJ-1" }, product: { rw_menucode: "09" }, option: null },
      {
        rw_rosewebid: "ignored",
        rw_rosewebpw: "secret",
        rw_assoc: "call0000",
        rw_associd: "assoc-intra-01",
        rw_returnurl: "ignored",
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
    expect(r.fields.rw_rosewebid).toBe("rose-web-id");
    expect(r.fields.rw_assoc).toBe("call0000");
    expect(r.fields.rw_returnurl).toBe("https://www.example.com/wooribugo/wooribu/newrun/po-return");
    expect(r.fields.rw_sno).toBe("11111111-1111-1111-1111-111111111111");
    expect(r.fields.rw_bdate).toBe("2026-04-28");
    expect(r.fields.rw_btime).toBe("14:00");
    expect(r.fields.rw_sujuid).toBe("SJ-1");
    expect(r.fields.rw_price).toBe("90000");
    expect(r.fields.rw_menucode).toBe("09");
    expect(r.fields.rw_qty).toBe("1");
    expect(r.fields.rw_sendsms).toBe("N");
    expect(r.fields.rw_sendfax).toBe("N");
    expect(r.fields.rw_associd).toBe("assoc-intra-01");

    for (const k of Object.keys(r.fields)) {
      expect(isIntranetPostRwKey(k)).toBe(true);
    }
    expect(Object.keys(r.fields)).toHaveLength(INTRANET_POST_RW_KEYS.length);
  });

  it("리본·장소·주문자 컬럼이 있으면 rw_arrive_place2·rw_sendpeople·rw_kyungjo·rw_jname 포함", () => {
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
      { florist: { rw_sujuid: "SJ", var_sid: "SJ" }, product: { rw_menucode: "33" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_associd: "",
        rw_returnurl: "https://x/po-return",
      },
      { headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_arrive_place2).toBe("DB장소상세");
    expect(r.fields.rw_sendpeople).toBe("리본보냄");
    expect(r.fields.rw_kyungjo).toBe("축하");
    expect(r.fields.rw_jname).toBe("주문자희");
    expect(r.fields.rw_menucode).toBe("33");
  });

  it("레거시 ribbon_message_kind=card 이면 rw_card에만 ribbon_message", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "44444444-4444-4444-4444-444444444444",
        order_no: "ORD-4",
        payment_status: "paid",
        total_amount: 1,
        shipping_name: "수취",
        shipping_phone: "01000000000",
        shipping_address: "서울",
        created_at: "2026-04-01T12:00:00.000Z",
        desired_delivery_date: "2026-04-02",
        ribbon_sender: "보냄",
        ribbon_message: "축하합니다",
        ribbon_message_kind: "card",
      },
      [],
      { florist: { rw_sujuid: "SJ", var_sid: "SJ" }, product: { rw_menucode: "08" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_associd: "",
        rw_returnurl: "https://x/po-return",
      },
      { headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_kyungjo).toBe("");
    expect(r.fields.rw_card).toBe("축하합니다");
  });

  it("ribbon_message + ribbon_card_message → rw_kyungjo·rw_card", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "55555555-5555-5555-5555-555555555555",
        order_no: "ORD-5",
        payment_status: "paid",
        total_amount: 1,
        shipping_name: "수취",
        shipping_phone: "01000000000",
        shipping_address: "서울",
        created_at: "2026-04-01T12:00:00.000Z",
        desired_delivery_date: "2026-04-02",
        ribbon_sender: "보냄",
        ribbon_message: "근조",
        ribbon_card_message: "삼가 고인의 명복을 빕니다",
      },
      [],
      { florist: { rw_sujuid: "SJ", var_sid: "SJ" }, product: { rw_menucode: "35" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_associd: "",
        rw_returnurl: "https://x/po-return",
      },
      { headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_kyungjo).toBe("근조");
    expect(r.fields.rw_card).toBe("삼가 고인의 명복을 빕니다");
  });

  it("신규 UI: ribbon_card_message 없으면 rw_card 비움", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "66666666-6666-6666-6666-666666666666",
        order_no: "ORD-6",
        payment_status: "paid",
        total_amount: 1,
        shipping_name: "수취",
        shipping_phone: "01000000000",
        shipping_address: "서울",
        created_at: "2026-04-01T12:00:00.000Z",
        desired_delivery_date: "2026-04-02",
        ribbon_sender: "보냄",
        ribbon_message: "축하",
      },
      [],
      { florist: { rw_sujuid: "SJ", var_sid: "SJ" }, product: { rw_menucode: "08" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_associd: "",
        rw_returnurl: "https://x/po-return",
      },
      { headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_kyungjo).toBe("축하");
    expect(r.fields.rw_card).toBe("");
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
      { florist: { rw_sujuid: "SJ", var_sid: "SJ" }, product: { rw_menucode: "09" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_associd: "",
        rw_returnurl: "https://x/po-return",
      },
      { strict: true, headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_bdate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("florist draft 없을 때 기본 rw_sujuid kot4545", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        order_no: "ORD-Y",
        payment_status: "paid",
        total_amount: 1,
        shipping_name: "수취",
        shipping_phone: "01000000000",
        shipping_address: "서울",
        created_at: "2026-04-01T12:00:00.000Z",
        desired_delivery_date: "2026-04-02",
      },
      [],
      { florist: null, product: { rw_menucode: "09" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_associd: "",
        rw_returnurl: "https://x/po-return",
      },
      { strict: true, headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_sujuid).toBe("kot4545");
    expect(r.fields.rw_menucode).toBe("09");
  });

  it("florist draft 에 rw_sujuid 있으면 기본값 대신 사용", () => {
    const r = mapOrderToNewrunPayload(
      {
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        order_no: "ORD-Z",
        payment_status: "paid",
        total_amount: 1,
        shipping_name: "수취",
        shipping_phone: "01000000000",
        shipping_address: "서울",
        created_at: "2026-04-01T12:00:00.000Z",
        desired_delivery_date: "2026-04-02",
      },
      [],
      { florist: { rw_sujuid: "OTHER" }, product: { rw_menucode: "09" }, option: null },
      {
        rw_rosewebid: "u",
        rw_rosewebpw: "p",
        rw_assoc: "a",
        rw_associd: "",
        rw_returnurl: "https://x/po-return",
      },
      { strict: true, headquartersBonbalju: true, rw_method: "1" }
    );
    expect(r.fields.rw_sujuid).toBe("OTHER");
  });

  it("NEWRUN_DEFAULT_RW_SUJUID 환경값이 있으면 내장 기본 대신 사용", () => {
    const prev = process.env.NEWRUN_DEFAULT_RW_SUJUID;
    process.env.NEWRUN_DEFAULT_RW_SUJUID = "env_sid";
    try {
      const r = mapOrderToNewrunPayload(
        {
          id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
          order_no: "ORD-E",
          payment_status: "paid",
          total_amount: 1,
          shipping_name: "수취",
          shipping_phone: "01000000000",
          shipping_address: "서울",
          created_at: "2026-04-01T12:00:00.000Z",
          desired_delivery_date: "2026-04-02",
        },
        [],
        { florist: null, product: { rw_menucode: "09" }, option: null },
        {
          rw_rosewebid: "u",
          rw_rosewebpw: "p",
          rw_assoc: "a",
          rw_associd: "",
          rw_returnurl: "https://x/po-return",
        },
        { strict: true, headquartersBonbalju: true, rw_method: "1" }
      );
      expect(r.fields.rw_sujuid).toBe("env_sid");
    } finally {
      if (prev === undefined) delete process.env.NEWRUN_DEFAULT_RW_SUJUID;
      else process.env.NEWRUN_DEFAULT_RW_SUJUID = prev;
    }
  });
  it("strict 모드에서 병합 draft 에 rw_menucode 없으면 검증 실패", () => {
    expect(() =>
      mapOrderToNewrunPayload(
        {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          order_no: "ORD-X",
          payment_status: "paid",
          total_amount: 1,
          shipping_name: "수취",
          shipping_phone: "01000000000",
          shipping_address: "서울",
          created_at: "2026-04-01T12:00:00.000Z",
          desired_delivery_date: "2026-04-02",
        },
        [],
        { florist: null, product: null, option: null },
        {
          rw_rosewebid: "u",
          rw_rosewebpw: "p",
          rw_assoc: "a",
          rw_associd: "",
          rw_returnurl: "https://x/po-return",
        },
        { strict: true, headquartersBonbalju: true, rw_method: "1" }
      )
    ).toThrow(/rw_menucode/);
  });
});
