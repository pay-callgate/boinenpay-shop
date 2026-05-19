"use client";

import { Megaphone } from "lucide-react";
import { AdminBoardComingSoonLayout } from "@/components/admin/AdminBoardComingSoonLayout";

/**
 * 공지사항 — 준비 중 (매출/거래처 분석과 동일 UI 톤)
 * /admin/notices
 */
export default function NoticesPage() {
  return (
    <AdminBoardComingSoonLayout
      eyebrow="Board · Notices"
      title="공지사항"
      titleIcon={Megaphone}
      description="파트너와 거래처(전용몰)에 전달할 공지를 등록하고 관리합니다."
    />
  );
}
