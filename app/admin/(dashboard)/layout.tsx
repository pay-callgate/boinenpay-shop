import React from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminDashboardShell } from "@/components/admin/AdminDashboardShell";
import { AdminIdleGuard } from "@/components/admin/AdminIdleGuard";
import { AdminToastWrapper } from "@/components/admin/AdminToastWrapper";

/** 세션 만료 시 즉시 리다이렉트 보장 — 레이아웃 캐시로 스냅샷처럼 보이는 현상 방지 */
export const dynamic = "force-dynamic";

/**
 * T1-1: 미인증 시 로그인 리다이렉트.
 * T1-5: 파트너 미등록 또는 미검증 시 기업 등록(온보딩)만 노출.
 * 중앙 집중형: 세션 기반 partner_id 조회 (partner_admins → partners).
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/admin/login?callbackUrl=/admin");
  }

  let supabase: ReturnType<typeof createServerSupabase>;
  try {
    supabase = createServerSupabase();
  } catch (e) {
    console.error("[AdminDashboardLayout] Supabase 초기화 실패", e);
    redirect(
      "/admin/login?error=Config&callbackUrl=/admin"
    );
  }
  const { data: adminRow } = await supabase
    .from("partner_admins")
    .select("partner_id")
    .eq("user_id", session.user.id!)
    .maybeSingle();

  const { data: partner } = adminRow?.partner_id
    ? await supabase
        .from("partners")
        .select("id, subdomain, company_name, verification_status")
        .eq("id", adminRow.partner_id)
        .maybeSingle()
    : { data: null };
  const isVerified = partner?.verification_status === "verified";

  // === 파트너 권한 디버깅 (원인 파악 후 제거) ===
  console.log("=== 파트너 권한 디버깅 ===");
  console.log("session.user.email:", session.user.email);
  console.log("session.user.id:", session.user.id);
  console.log("adminRow (partner_admins):", adminRow ? { partner_id: adminRow.partner_id } : null);
  console.log("partnerId:", adminRow?.partner_id ?? null);
  console.log("partner (partners row):", partner ? { id: partner.id, subdomain: partner.subdomain, company_name: partner.company_name, verification_status: partner.verification_status } : null);
  console.log("isVerified:", isVerified);
  console.log("==========================");

  if (!adminRow?.partner_id) {
    redirect("/admin/onboarding/partner");
  }
  if (!partner || !isVerified) {
    redirect("/admin/onboarding/partner");
  }

  // 사이드바 상단 표시: DB 파트너사명(company_name) 우선, 없으면 subdomain, 둘 다 없으면 fallback
  const companyName = partner.company_name?.trim() || null;
  const partnerDisplayName =
    companyName || partner.subdomain?.trim() || "파트너";

  return (
    <AdminToastWrapper>
      <AdminIdleGuard>
        <AdminDashboardShell
          partnerDisplayName={partnerDisplayName}
          userName={session.user.name ?? undefined}
        >
          {children}
        </AdminDashboardShell>
      </AdminIdleGuard>
    </AdminToastWrapper>
  );
}
