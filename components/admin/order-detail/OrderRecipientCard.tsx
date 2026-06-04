"use client";

import { Copy, MapPin } from "lucide-react";
import { formatPhysicalShippingAddressWithPostcode } from "@/lib/checkout-florist-fields";
import {
  buildKakaoMapSearchHref,
  buildKakaoMapSearchQuery,
} from "@/lib/kakao-map-search-url";

type Props = {
  name: string;
  phone: string;
  postcode: string | null;
  address: string;
  addressDetail: string | null;
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    alert("복사에 실패했습니다.");
    return;
  }
  void label;
}

export function OrderRecipientCard({
  name,
  phone,
  postcode,
  address,
  addressDetail,
}: Props) {
  const fullAddress = formatPhysicalShippingAddressWithPostcode(
    postcode,
    address,
    addressDetail
  );

  const mapSearchQuery = buildKakaoMapSearchQuery({
    postcode,
    address,
    addressDetail,
  });
  const mapHref = buildKakaoMapSearchHref(mapSearchQuery);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm [@media(min-width:768px)_and_(max-height:860px)]:p-4">
      <h2 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4 text-lg font-bold text-gray-900 [@media(min-width:768px)_and_(max-height:860px)]:mb-3 [@media(min-width:768px)_and_(max-height:860px)]:pb-3">
        <MapPin className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
        수령인 및 배송지 정보
      </h2>
      <dl className="space-y-3">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">받는 분</dt>
          <dd className="min-w-0 flex-1">
            <span className="text-sm font-medium text-gray-900">{name || "—"}</span>
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">연락처</dt>
          <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{phone || "—"}</span>
            {phone ? (
              <button
                type="button"
                onClick={() => void copyText(phone, "phone")}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-900 hover:bg-gray-100"
              >
                <Copy className="h-3.5 w-3.5" />
                복사
              </button>
            ) : null}
          </dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">주소</dt>
          <dd className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap text-sm font-medium text-gray-900">
              {fullAddress || "—"}
            </p>
            {fullAddress ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {mapHref ? (
                  <a
                    href={mapHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-black px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors hover:bg-gray-800"
                  >
                    <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                    지도에서 위치 확인
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => void copyText(fullAddress, "addr")}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-900 hover:bg-gray-100"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  주소 복사
                </button>
              </div>
            ) : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}
