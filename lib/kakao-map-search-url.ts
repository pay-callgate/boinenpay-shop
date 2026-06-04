import { formatPhysicalShippingAddressForDisplay } from "@/lib/checkout-florist-fields";

/**
 * 도로명·지번 등 물리 주소만 추출 (우편번호·화훼 메타·장소 안내 문구 제외)
 */
export function buildKakaoMapSearchQuery(params: {
  postcode?: string | null;
  address: string;
  addressDetail?: string | null;
}): string {
  let query = formatPhysicalShippingAddressForDisplay(
    params.address,
    params.addressDetail
  );

  query = query
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\[\d{5,6}\]\s*/u, "")
    .replace(/^\d{5,6}(?:-\d{3})?\s+/u, "")
    .trim();

  // 효령로77길 → 효령로 77길 (로/길/번길 앞 숫자 분리 — 카카오 검색 호환)
  query = query.replace(
    /([가-힣]+(?:로|길))(\d+(?:번길|길)?)/gu,
    "$1 $2"
  );

  return query.trim();
}

/**
 * 카카오맵 검색 URL — query 파라미터 방식(경로 인코딩·특수문자 이슈 회피)
 */
export function buildKakaoMapSearchHref(query: string): string | null {
  const q = query.trim();
  if (!q || q.length < 2) return null;
  return `https://map.kakao.com/?q=${encodeURIComponent(q)}`;
}
