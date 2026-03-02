"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
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
 * T1-2: 기업 등록 온보딩 페이지 (중앙 집중형).
 * 기업 등록 폼은 모달 팝업으로 표시.
 */
export default function PartnerOnboardingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  const handleSuccess = () => {
    setIsOpen(false);
    router.push("/admin");
    router.refresh();
  };

  const handleCancel = () => {
    setIsOpen(false);
    router.push("/admin/login");
  };

  return (
    <>
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
            subdomain=""
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
