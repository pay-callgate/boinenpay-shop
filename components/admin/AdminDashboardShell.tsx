"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { PartnerSettingsModal } from "@/components/admin/PartnerSettingsModal";
import { PartnerSettingsModalContext } from "@/components/admin/PartnerSettingsModalContext";

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

  return (
    <PartnerSettingsModalContext.Provider value={ctxValue}>
      <div className="flex h-screen flex-col overflow-hidden bg-[#F5F7FA]">
        <AdminHeader />
        <div className="flex min-h-0 flex-1">
          <AdminSidebar
            partnerDisplayName={partnerDisplayName}
            userName={userName}
          />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-6">
            {children}
          </main>
        </div>
      </div>
      <PartnerSettingsModal open={partnerSettingsOpen} onClose={closePartnerSettings} />
    </PartnerSettingsModalContext.Provider>
  );
}
