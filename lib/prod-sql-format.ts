/** SQL literal helpers for prod migration dump generation */

export function sqlString(value: string | null | undefined): string {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlNumber(value: number | string | null | undefined): string {
  if (value == null || value === "") return "NULL";
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? String(n) : "NULL";
}

export function sqlBoolean(value: boolean | null | undefined): string {
  if (value == null) return "NULL";
  return value ? "TRUE" : "FALSE";
}

export function sqlJsonb(value: unknown): string {
  if (value == null) return "NULL";
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

export function sqlTimestamptz(value: string | Date | null | undefined): string {
  if (value == null) return "NULL";
  const iso = value instanceof Date ? value.toISOString() : String(value);
  return `${sqlString(iso)}::timestamptz`;
}

export function sqlTextArray(values: string[] | null | undefined): string {
  if (!values?.length) return `'{}'::text[]`;
  const inner = values.map((v) => sqlString(v)).join(", ");
  return `ARRAY[${inner}]::text[]`;
}

/** product id — neuron 코드 기준 결정적 UUID (재실행 시 동일) */
export function deterministicProductId(neuronCode: string): string {
  const hex = neuronCode.replace(/\D/g, "").padStart(12, "0").slice(-12);
  return `a0000000-0000-4000-8000-${hex}`;
}

export function deterministicCategoryId(slug: string): string {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const hex = hash.toString(16).padStart(12, "0").slice(-12);
  return `c0000000-0000-4000-8000-${hex}`;
}
