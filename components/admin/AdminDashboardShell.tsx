"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { PartnerSettingsModal } from "@/components/admin/PartnerSettingsModal";
import { PartnerSettingsModalContext } from "@/components/admin/PartnerSettingsModalContext";
import { useAdminOrderUnreadNotify } from "@/hooks/use-admin-order-unread-notify";

export function AdminDashboardShell({
  children,
  partnerDisplayName,
  userName,
}: {
  children: React.ReactNode;
  partnerDisplayName: string;
  userName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [partnerSettingsOpen, setPartnerSettingsOpen] = useState(
    () => pathname === "/admin/settings"
  );

  /** 직접 /admin/settings 접근 시 열림. 다른 경로로 이동하면 닫힘 */
  useEffect(() => {
    setPartnerSettingsOpen(pathname === "/admin/settings");
  }, [pathname]);

  const openPartnerSettings = useCallback(() => setPartnerSettingsOpen(true), []);

  const closePartnerSettings = useCallback(() => {
    setPartnerSettingsOpen(false);
    if (pathname === "/admin/settings") {
      router.replace("/admin");
    }
  }, [pathname, router]);

  const ctxValue = useMemo(
    () => ({ openPartnerSettings }),
    [openPartnerSettings]
  );

  const unreadOrderNotify = useAdminOrderUnreadNotify();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <PartnerSettingsModalContext.Provider value={ctxValue}>
      <div className="flex h-screen flex-col overflow-hidden bg-[#F5F7FA]">
        <AdminHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <AdminSidebar
            partnerDisplayName={partnerDisplayName}
            userName={userName}
            unreadOrderNotify={unreadOrderNotify}
            className="hidden h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 md:flex"
          />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden overflow-x-hidden p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="메뉴 닫기"
            onClick={() => setMobileNavOpen(false)}
          />
          <AdminSidebar
            partnerDisplayName={partnerDisplayName}
            userName={userName}
            unreadOrderNotify={unreadOrderNotify}
            onNavigate={() => setMobileNavOpen(false)}
            showDrawerClose
            onDrawerClose={() => setMobileNavOpen(false)}
            className="absolute top-0 left-0 flex h-full max-w-[min(20rem,88vw)] flex-col border-r border-slate-800 bg-slate-900 shadow-xl"
          />
        </div>
      ) : null}

      <PartnerSettingsModal open={partnerSettingsOpen} onClose={closePartnerSettings} />
    </PartnerSettingsModalContext.Provider>
  );
}
