/** Supabase Storage public URL 파싱·운영 이전용 호스트 치환 */

const PUBLIC_OBJECT_RE =
  /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;

export type ParsedStorageObject = {
  bucket: string;
  path: string;
};

export function parseSupabaseStoragePublicUrl(
  url: string | null | undefined
): ParsedStorageObject | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const match = parsed.pathname.match(PUBLIC_OBJECT_RE);
    if (!match) return null;
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

export function rewriteSupabasePublicUrl(
  url: string | null | undefined,
  targetSupabaseUrl: string | null | undefined
): string | null {
  if (!url?.trim()) return null;
  const target = targetSupabaseUrl?.trim().replace(/\/$/, "");
  if (!target) return url.trim();

  const parsed = parseSupabaseStoragePublicUrl(url);
  if (!parsed) return url.trim();

  const encodedPath = parsed.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${target}/storage/v1/object/public/${parsed.bucket}/${encodedPath}`;
}

export function collectStorageObjectsFromUrls(
  urls: Iterable<string | null | undefined>
): ParsedStorageObject[] {
  const seen = new Set<string>();
  const out: ParsedStorageObject[] = [];

  for (const url of urls) {
    const parsed = parseSupabaseStoragePublicUrl(url);
    if (!parsed) continue;
    const key = `${parsed.bucket}/${parsed.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }

  return out;
}
