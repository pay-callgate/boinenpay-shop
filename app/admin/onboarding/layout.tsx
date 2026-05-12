import React from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminToastWrapper } from "@/components/admin/AdminToastWrapper";

/**
 * 온보딩 페이지 레이아웃 (중앙 집중형).
 * 로그인된 사용자에게 Admin 레이아웃(헤더+사이드바) 표시.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/admin/login?callbackUrl=/admin/onboarding/partner");
  }

  return (
    <AdminToastWrapper>
      <div className="flex min-h-screen flex-col bg-[#F5F7FA]">
        <AdminHeader />
        <div className="flex flex-1">
          <AdminSidebar partnerDisplayName="파트너 등록" userName={session.user.name ?? undefined} />
          <main className="flex-1 overflow-auto p-6">
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">사업장 정보 등록을 진행해주세요.</p>
            </div>
            {children}
          </main>
        </div>
      </div>
    </AdminToastWrapper>
  );
}
