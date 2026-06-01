import { describe, expect, it } from "vitest";
import {
  cartShowsPreferredTimeSlot,
  resolveOrderDeliveryTimeSlot,
} from "@/lib/cart-preferred-time-slot";
import { DELIVERY_TIME_SLOT_ASAP } from "@/lib/checkout-florist-fields";

const 축하화환 = {
  id: "c1",
  name: "축하화환",
  slug: "celebration-wreath",
  show_preferred_time: true,
};

const 근조 = {
  id: "c2",
  name: "근조화환",
  slug: "condolence",
  show_preferred_time: false,
};

function line(cats: { show_preferred_time?: boolean | null }[]) {
  return {
    product: {
      product_category_mappings: cats.map((c) => ({ category: c })),
    },
  };
}

describe("cartShowsPreferredTimeSlot", () => {
  it("returns true when every category on every line is show_preferred_time", () => {
    expect(cartShowsPreferredTimeSlot([line([축하화환])])).toBe(true);
  });

  it("returns false when any category is false (mixed cart)", () => {
    expect(cartShowsPreferredTimeSlot([line([축하화환]), line([근조])])).toBe(false);
  });

  it("returns false when one product has mixed categories", () => {
    expect(cartShowsPreferredTimeSlot([line([축하화환, 근조])])).toBe(false);
  });

  it("returns false for empty cart", () => {
    expect(cartShowsPreferredTimeSlot([])).toBe(false);
  });

  it("returns false when product has no category", () => {
    expect(cartShowsPreferredTimeSlot([{ product: { product_category_mappings: [] } }])).toBe(
      false
    );
  });
});

describe("resolveOrderDeliveryTimeSlot", () => {
  it("uses ASAP when picker hidden", () => {
    expect(resolveOrderDeliveryTimeSlot(false, "14:00~16:00")).toBe(DELIVERY_TIME_SLOT_ASAP);
  });

  it("uses selected slot when picker visible", () => {
    expect(resolveOrderDeliveryTimeSlot(true, "11:00~13:00")).toBe("11:00~13:00");
  });
});
