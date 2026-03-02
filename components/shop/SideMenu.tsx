"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { X, Heart, ShoppingBag, User, Search, ChevronDown } from "lucide-react";
import type { ShopPartner, ShopClient } from "./ShopLayout";
import { PREVIEW_SLUG } from "./ShopLayout";
import { useShopTemplate } from "./ShopTemplateContext";

const PRIMARY = "#D6A8E0";

/** 카테고리명 표시: 파이프 주변 공백 (예: 관엽|화분 → 관엽 | 화분) */
function formatCategoryName(name: string): string {
  return name.replace(/\|/g, " | ");
}

/** API에서 오는 플랫 카테고리 (product_categories) */
export interface SideMenuCategoryFlat {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  sort_order?: number | null;
}

/** 트리 노드: 최상위(Root) 또는 하위가 있으면 children 배열 포함 */
export interface SideMenuCategoryNode {
  id: string;
  name: string;
  slug: string;
  children: SideMenuCategoryNode[];
}

/**
 * 플랫 카테고리 배열을 parent_id 기준으로 그룹화하여
 * 최상위 카테고리(Root) 목록 + 각 노드의 children 트리 구조로 재가공
 */
function buildCategoryTree(flat: SideMenuCategoryFlat[]): SideMenuCategoryNode[] {
  // 1) parent_id로 그룹화: key = parent_id (null이면 루트)
  const byParent = new Map<string | null, SideMenuCategoryFlat[]>();
  flat.forEach((c) => {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  });
  // 2) 최상위 카테고리(Root)만 추출
  const roots = flat.filter((c) => !c.parent_id);
  const sort = (list: SideMenuCategoryFlat[]) =>
    [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  function toNode(c: SideMenuCategoryFlat): SideMenuCategoryNode {
    const childrenFlat = byParent.get(c.id) ?? [];
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      children: sort(childrenFlat).map(toNode),
    };
  }
  return sort(roots).map(toNode);
}

export interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  subdomain: string;
  clientSlug: string | null;
  partner: ShopPartner;
  client: ShopClient | null;
  orderAllowed: boolean;
  /** 좌측 메뉴 내 Search 버튼 클릭 시 호출 (검색 모달 열기). 전달 시 Search 버튼이 동작함 */
  onSearchClick?: () => void;
}

export function SideMenu({
  isOpen,
  onClose,
  subdomain,
  clientSlug,
  partner,
  client,
  orderAllowed,
  onSearchClick,
}: SideMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategorySlug = searchParams?.get("category") ?? null;
  const { data: session } = useSession();
  const ensureOrderAllowed = useShopTemplate()?.ensureOrderAllowed;
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [flatCategories, setFlatCategories] = useState<SideMenuCategoryFlat[]>([]);

  const categoriesTree = useMemo(() => buildCategoryTree(flatCategories), [flatCategories]);

  useEffect(() => {
    setLogoLoadError(false);
  }, [client?.id, client?.logo_url]);

  useEffect(() => {
    if (!partner?.id) return;
    let cancelled = false;
    fetch(`/api/shop/categories?partnerId=${partner.id}&onlyWithProducts=true`)
      .then((res) => (res.ok ? res.json() : { categories: [] }))
      .then((data) => {
        if (!cancelled) setFlatCategories(data?.categories ?? []);
      })
      .catch(() => {
        if (!cancelled) setFlatCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [partner?.id]);

  const base = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}/${PREVIEW_SLUG}`;
  const homeHref = clientSlug ? `/${subdomain}/${clientSlug}` : `/${subdomain}`;
  const cartHref = `${base}/cart`;
  const wishlistHref = `${base}/mypage/wishlist`;
  const mypageHref = `${base}/mypage`;

  const handleLinkClick = () => {
    onClose();
  };

  const displayName = client?.name ?? partner.company_name ?? "쇼핑몰";
  const showLogoImg = client?.logo_url && !logoLoadError;
  const logoContent = showLogoImg ? (
    <img
      src={client!.logo_url!}
      alt={client!.name}
      className="h-6 max-w-[120px] object-contain"
      onError={() => setLogoLoadError(true)}
    />
  ) : (
    <span className="text-base font-semibold tracking-tight text-[#333333]">{displayName}</span>
  );

  return (
    <>
      {/* 오버레이: 어두운 반투명, 클릭 시 닫기. 닫힐 때는 투명·비클릭 */}
      <div
        className={`fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
        onClick={onClose}
      />
      {/* X 닫기 버튼: 오버레이 영역 우측 상단, 어두운 배경 위에서 흰색 */}
      <button
        type="button"
        onClick={onClose}
        className={`fixed top-4 right-4 z-[102] flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-opacity duration-300 hover:bg-white/10 hover:text-white ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label="메뉴 닫기"
      >
        <X className="h-7 w-7" strokeWidth={2} />
      </button>
      {/* 슬라이딩 패널: -translate-x-full → translate-x-0 */}
      <aside
        className={`fixed left-0 top-0 z-[101] h-screen w-[80vw] max-w-sm bg-white shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="사이드 메뉴"
      >
        <div className="flex h-full flex-col">
          {/* 1. 상단 헤더: 로고 + 로그아웃/로그인 + X 닫기 */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 px-4">
            <Link href={homeHref} onClick={() => onClose()} className="flex items-center">
              {logoContent}
            </Link>
            <div className="flex items-center gap-1">
              {session?.user ? (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: `${base}` })}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  로그아웃
                </button>
              ) : (
                <Link
                  href={`/${subdomain}/login?callbackUrl=${encodeURIComponent(pathname ?? base)}`}
                  onClick={() => onClose()}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  로그인
                </Link>
              )}
            </div>
          </div>

          {/* 2. 퀵 액션: 파스텔 보라 배경, 4버튼, 슬림 + 세로 구분선 */}
          <div
            className="grid grid-cols-4 divide-x divide-white/30 shrink-0 py-2.5 px-1"
            style={{ backgroundColor: PRIMARY }}
          >
            <Link
              href={wishlistHref}
              onClick={handleLinkClick}
              className="flex flex-col items-center justify-center gap-1 py-4 text-white"
            >
              <Heart className="h-6 w-6" strokeWidth={1.5} />
              <span className="text-xs font-medium">Wish</span>
            </Link>
            <Link
              href={cartHref}
              onClick={handleLinkClick}
              className="flex flex-col items-center justify-center gap-1 py-4 text-white"
            >
              <ShoppingBag className="h-6 w-6" strokeWidth={1.5} />
              <span className="text-xs font-medium">Cart</span>
            </Link>
            <Link
              href={mypageHref}
              onClick={handleLinkClick}
              className="flex flex-col items-center justify-center gap-1 py-4 text-white"
            >
              <User className="h-6 w-6" strokeWidth={1.5} />
              <span className="text-xs font-medium">My Page</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSearchClick?.();
              }}
              className="flex flex-col items-center justify-center gap-1 py-4 text-white"
              aria-label="검색"
            >
              <Search className="h-6 w-6" strokeWidth={1.5} />
              <span className="text-xs font-medium">Search</span>
            </button>
          </div>

          {/* 3. 카테고리 트리 아코디언 (어드민 계층 구조 1:1 반영) */}
          <nav className="flex-1 overflow-y-auto" aria-label="카테고리 메뉴">
            <ul className="py-2">
              {categoriesTree.map((node) => (
                <li key={node.id} className="border-b border-gray-100">
                  {node.children && node.children.length > 0 ? (
                    <>
                      {/* 부모: 토글 버튼 */}
                      <button
                        type="button"
                        onClick={() => setOpenCategoryId(openCategoryId === node.id ? null : node.id)}
                        className="flex w-full items-center justify-between bg-transparent px-4 py-3.5 text-left text-sm font-medium text-gray-800 active:opacity-70"
                        aria-expanded={openCategoryId === node.id}
                        aria-controls={`side-menu-sub-${node.id}`}
                        id={`side-menu-btn-${node.id}`}
                      >
                        <span>{formatCategoryName(node.name)}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ease-out ${
                            openCategoryId === node.id ? "rotate-180" : ""
                          }`}
                          aria-hidden
                        />
                      </button>
                      {/* 하위(2차) 카테고리: 우아하고 차분한 그레이톤 전체 폭 적용 */}
                      <ul
                        id={`side-menu-sub-${node.id}`}
                        role="region"
                        aria-labelledby={`side-menu-btn-${node.id}`}
                        className="overflow-hidden bg-[#fafafa] transition-all duration-200 ease-out"
                      >
                        {openCategoryId === node.id &&
                          node.children.map((child) => {
                            const isSelected = currentCategorySlug === child.slug;
                            return (
                              <li key={child.id}>
                                <Link
                                  href={`${base}/products?category=${encodeURIComponent(child.slug)}`}
                                  onClick={() => onClose()}
                                  className={`block py-3 pl-8 pr-4 text-sm transition-colors active:opacity-80 ${
                                    isSelected
                                      ? "font-medium text-gray-900"
                                      : "text-gray-500 hover:text-gray-900"
                                  }`}
                                >
                                  {formatCategoryName(child.name)}
                                </Link>
                              </li>
                            );
                          })}
                      </ul>
                    </>
                  ) : (
                    /* 단일(1-Depth): 화살표 없이 바로 링크, 터치 피드백만 */
                    <Link
                      href={`${base}/products?category=${encodeURIComponent(node.slug)}`}
                      onClick={() => onClose()}
                      className="block bg-transparent px-4 py-3.5 text-sm font-medium text-gray-800 active:opacity-70"
                    >
                      {formatCategoryName(node.name)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
    </>
  );
}
