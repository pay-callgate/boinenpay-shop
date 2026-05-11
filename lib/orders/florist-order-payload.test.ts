import { describe, expect, it } from "vitest";
import { floristFieldsFromOrderBody } from "./florist-order-payload";

describe("floristFieldsFromOrderBody", () => {
  it("parses delivery date, slots, memo, ribbon", () => {
    const f = floristFieldsFromOrderBody({
      deliveryDate: "2026-03-15",
      deliveryTimeSlot: " 14:00~16:00 ",
      deliveryMethod: "parcel",
      deliveryRequestMemo: " 문 앞 ",
      ribbonSender: " 홍길동 ",
      ribbonMessage: " 근조 ",
    });
    expect(f.desired_delivery_date).toBe("2026-03-15");
    expect(f.delivery_time_slot).toBe("14:00~16:00");
    expect(f.delivery_method).toBe("parcel");
    expect(f.delivery_request_memo).toBe("문 앞");
    expect(f.ribbon_sender).toBe("홍길동");
    expect(f.ribbon_message).toBe("근조");
    expect(f.ribbon_card_message).toBeNull();
  });

  it("parses detailPlace / venueDetail aliases into venue_detail", () => {
    expect(
      floristFieldsFromOrderBody({
        detailPlace: "  201호 로비  ",
      }).venue_detail
    ).toBe("201호 로비");
    expect(
      floristFieldsFromOrderBody({
        venueDetail: "홀 A",
      }).venue_detail
    ).toBe("홀 A");
  });

  it("rejects invalid date strings", () => {
    const f = floristFieldsFromOrderBody({
      deliveryDate: "03/15/2026",
      deliveryTimeSlot: "오전",
    });
    expect(f.desired_delivery_date).toBeNull();
    expect(f.delivery_time_slot).toBe("오전");
  });

  it("parses optional ribbon card message", () => {
    const f = floristFieldsFromOrderBody({
      ribbonMessage: "근조",
      ribbonCardMessage: "삼가 고인의 명복을 빕니다",
    });
    expect(f.ribbon_message).toBe("근조");
    expect(f.ribbon_card_message).toBe("삼가 고인의 명복을 빕니다");
  });

  it("accepts snake_case aliases", () => {
    const f = floristFieldsFromOrderBody({
      ribbon_sender: "김",
      ribbon_message: "축하",
      request_memo: "부재 시",
    });
    expect(f.ribbon_sender).toBe("김");
    expect(f.ribbon_message).toBe("축하");
    expect(f.delivery_request_memo).toBe("부재 시");
  });
});
