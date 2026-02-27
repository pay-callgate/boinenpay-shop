import { createServerSupabase } from "@/lib/supabase/server";
import { ShopGlobalLayout } from "@/components/shop/ShopLayout";
import { ClientShopProvider } from "@/components/providers/ClientShopProvider";

/**
 * 쇼핑몰 글로벌 레이아웃: SmartHeader + 메인(safe area) + GlobalBottomNav.
 *
 * PRD: 거래처 전용 쇼핑몰 URL은 반드시 소속 파트너의 마스터 템플릿 기반으로 렌더링.
 * - subdomain → 파트너(partner) 식별 → 해당 파트너의 테마/레이아웃/상품(마스터 템플릿) 로드
 * - clientSlug → 해당 파트너 소속 거래처(client) 식별 → 로고·거래처명 등만 오버레이
 * - _preview: 거래처 없이 마스터 템플릿 미리보기(주문·장바구니 담기 차단)
 */
export default async function ClientShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string; clientSlug: string }>;
}) {
  const { subdomain, clientSlug } = await params;
  let partner: { id: string; subdomain: string; company_name: string } | null = null;
  let client: { id: string; slug: string; name: string; logo_url: string | null; partner_id: string } | null = null;

  try {
    const supabase = createServerSupabase();
    const { data: partnerRow, error: partnerError } = await supabase
      .from("partners")
      .select("id, subdomain, company_name")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (!partnerError && partnerRow) {
      partner = {
        id: partnerRow.id,
        subdomain: partnerRow.subdomain,
        company_name: partnerRow.company_name,
      };
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("id, partner_id, slug, name, logo_url")
        .eq("partner_id", partnerRow.id)
        .order("created_at", { ascending: false });

      // 마스터 템플릿 미리보기: _preview면 거래처 없이 진입 허용
      if (clientSlug !== "_preview" && !clientsError && clients?.length) {
        const found = clients.find((c) => c.slug === clientSlug);
        if (found)
          client = {
            id: found.id,
            slug: found.slug,
            name: found.name,
            logo_url: found.logo_url ?? null,
            partner_id: found.partner_id,
          };
      }
    }
  } catch {
    // leave partner/client null
  }

  return (
    <ClientShopProvider>
      <ShopGlobalLayout
        subdomain={subdomain}
        clientSlug={clientSlug}
        partner={partner}
        client={client}
      >
        {children}
      </ShopGlobalLayout>
    </ClientShopProvider>
  );
}
