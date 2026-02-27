"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { PartnerRegistrationForm } from "@/components/admin/PartnerRegistrationForm";

/**
 * T1-2: 기업 등록 온보딩 페이지 (Admin Layout + 모달 팝업 방식)
 * 
 * 변경 사항:
 * - 로그인된 사용자에게 Admin 레이아웃(사이드바/헤더) 표시
 * - 기업 등록 폼은 모달 팝업으로 표시
 * - 참고 이미지: 가맹점 상세정보 Admin 스타일
 */
export default function PartnerOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const subdomain = (params?.subdomain as string) ?? "";
  const [isOpen, setIsOpen] = useState(true); // 페이지 진입 시 자동으로 모달 오픈

  const handleSuccess = () => {
    // 등록 성공 시 모달 닫고 대시보드로 이동
    setIsOpen(false);
    router.push(`/${subdomain}/admin`);
    router.refresh();
  };

  const handleCancel = () => {
    // 취소 시 로그인 화면으로 이동
    setIsOpen(false);
    router.push(`/${subdomain}/admin/login`);
  };

  return (
    <>
      {/* Dialog 모달 */}
      <Dialog open={isOpen} onOpenChange={handleCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogClose />
            <DialogTitle>기업 등록</DialogTitle>
            <DialogDescription>
              사업자 정보를 입력하고 검증 후 파트너 어드민을 이용할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <PartnerRegistrationForm
            subdomain={subdomain}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
