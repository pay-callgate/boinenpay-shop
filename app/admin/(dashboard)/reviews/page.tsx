"use client";

import { Star } from "lucide-react";
import { AdminBoardComingSoonLayout } from "@/components/admin/AdminBoardComingSoonLayout";

/**
 * 리뷰 관리 — 준비 중 (매출/거래처 분석과 동일 UI 톤)
 * /admin/reviews
 */
export default function ReviewsPage() {
  return (
    <AdminBoardComingSoonLayout
      eyebrow="Board · Reviews"
      title="리뷰 관리"
      titleIcon={Star}
      description="쇼핑몰 상품 리뷰를 조회·검수하고 응대할 수 있도록 준비하고 있습니다."
    />
  );
}
