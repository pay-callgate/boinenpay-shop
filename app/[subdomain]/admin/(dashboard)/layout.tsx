import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * T1-1: 미인증 시 로그인 리다이렉트.
 * T1-5: 파트너 미등록 또는 미검증 시 기업 등록(온보딩)만 노출.
 * T1-4: Header + Sidebar + Main (TRD CallGate 스타일)
 */
export default async function AdminDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${subdomain}/admin/login?callbackUrl=/${subdomain}/admin`);
  }

  const supabase = createServerSupabase();
  const { data: partner } = await supabase
    .from("partners")
    .select("id, verification_status")
    .eq("subdomain", subdomain)
    .maybeSingle();
  const { data: admin } = partner
    ? await supabase
        .from("partner_admins")
        .select("id")
        .eq("user_id", session.user!.id!)
        .eq("partner_id", partner.id)
        .maybeSingle()
    : { data: null };

  const hasPartner = !!admin;
  const isVerified = partner?.verification_status === "verified";

  if (!hasPartner || !isVerified) {
    redirect(`/${subdomain}/admin/onboarding/partner`);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F5F7FA]">
      <AdminHeader subdomain={subdomain} />
      <div className="flex min-h-0 flex-1">
        <AdminSidebar subdomain={subdomain} userName={session.user.name ?? undefined} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
