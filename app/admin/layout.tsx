import React from "react";

/**
 * 파트너 어드민 공통 레이아웃 (중앙 집중형).
 * 로그인·대시보드 공통. Header/Sidebar는 (dashboard)/layout에서 적용 (T1-4).
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
