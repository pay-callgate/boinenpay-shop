"use client";

import { createContext, useContext } from "react";

/** 컨텍스트용 타입 (ShopLayout에서 import한 타입과 동일 구조) */
export interface ShopPartnerContext {
  id: string;
  subdomain: string;
  company_name: string;
}
export interface ShopClientContext {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  partner_id: string;
}

/**
 * 쇼핑몰 마스터 템플릿 컨텍스트
 * - orderAllowed: 거래처 전용 URL에서만 true (주문 가능)
 * - 파트너 메인에서는 false → 주문 시도 시 Alert
 * - 데이터 무결성: client_id는 URL의 clientSlug에서만 유도
 * - partner/client: 글로벌 레이아웃에서 주입 시 페이지에서 재조회 생략 가능
 */
export interface ShopTemplateContextValue {
  orderAllowed: boolean;
  subdomain: string;
  clientSlug: string | null;
  /** 주문 관련 액션 시 호출. 파트너 메인에서는 Alert 후 차단 */
  ensureOrderAllowed: () => boolean;
  partner?: ShopPartnerContext | null;
  client?: ShopClientContext | null;
}

const ShopTemplateContext = createContext<ShopTemplateContextValue | null>(null);

export function useShopTemplate() {
  const ctx = useContext(ShopTemplateContext);
  return ctx;
}

export function ShopTemplateProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ShopTemplateContextValue;
}) {
  return (
    <ShopTemplateContext.Provider value={value}>
      {children}
    </ShopTemplateContext.Provider>
  );
}
