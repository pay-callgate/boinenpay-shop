import {
  formatFloristShippingAddressForCustomerUI,
  stripFloristMetaSuffixFromAddressLine,
  stripFloristShippingDetailMeta,
} from "@/lib/checkout-florist-fields";

/** 카카오맵 검색에 넣지 않을 상세 안내(장소 메모·내부 메타) */
function isNonPhysicalDetailLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^[\u2014\u2013–—\-\s]+$/u.test(t)) return true;
  if (t === "--" || t === "—") return true;
  if (t.startsWith("예:")) return true;
  if (t.startsWith("[")) return true;
  if (/전달해\s*주세요|부고장|청첩장|010[\d-]{7,}|02[\d-]{7,}/u.test(t)) return true;
  return false;
}

function physicalDetailForMap(detail: string | null | undefined): string {
  const cleaned = stripFloristShippingDetailMeta(detail);
  if (!cleaned) return "";
  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isNonPhysicalDetailLine(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 도로명·지번 등 물리 주소만 추출 (우편번호·화훼 메타·장소 안내 문구 제외)
 */
export function buildKakaoMapSearchQuery(params: {
  postcode?: string | null;
  address: string;
  addressDetail?: string | null;
}): string {
  const roadLine = stripFloristMetaSuffixFromAddressLine(
    stripFloristShippingDetailMeta(params.address) || params.address.trim()
  );
  const detailLine = physicalDetailForMap(params.addressDetail);

  let query = [roadLine, detailLine].filter(Boolean).join(" ");

  if (!query.trim()) {
    query = formatFloristShippingAddressForCustomerUI(
      params.address,
      params.addressDetail
    );
  }

  query = query
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\[\d{5,6}\]\s*/u, "")
    .replace(/^\d{5,6}(?:-\d{3})?\s+/u, "")
    .replace(/\s*[—–]\s*$/u, "")
    .replace(/\s*--\s*$/u, "")
    .replace(/\s+[—–-]{2,}\s*$/u, "")
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
