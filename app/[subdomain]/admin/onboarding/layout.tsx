import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

/**
 * 온보딩 페이지 레이아웃
 * - 로그인된 사용자에게 Admin 레이아웃(헤더+사이드바) 표시
 * - 모달 뒤에 Admin UI가 보이도록 구성
 */
export default async function OnboardingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const session = await getServerSession(authOptions);
  
  // 미로그인 시 로그인 페이지로 리다이렉트
  if (!session?.user) {
    redirect(`/${subdomain}/admin/login?callbackUrl=/${subdomain}/admin/onboarding/partner`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FA]">
      <AdminHeader subdomain={subdomain} />
      <div className="flex flex-1">
        <AdminSidebar subdomain={subdomain} userName={session.user.name ?? undefined} />
        <main className="flex-1 overflow-auto p-6">
          {/* 빈 대시보드 영역 - 모달 뒤에 보임 */}
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">파트너 등록을 진행해주세요</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
