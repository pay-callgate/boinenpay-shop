/** cart_items.option_json 동등 비교 (POST merge·duplicate-check 공통) */
export function cartOptionsEqual(
  a: object | null | undefined,
  b: object | null | undefined
): boolean {
  if (!a && !b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function findMatchingCartItem<T extends { option_json: object | null }>(
  items: T[] | null | undefined,
  optionJson: object | null | undefined
): T | undefined {
  return (items ?? []).find((item) => cartOptionsEqual(optionJson ?? null, item.option_json));
}
