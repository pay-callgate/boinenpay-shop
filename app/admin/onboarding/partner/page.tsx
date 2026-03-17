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
        <DialogContent
          className="w-full sm:max-w-2xl"
          backdropText="사업장(기업)정보를 등록해주세요"
        >
          <DialogHeader>
            <DialogClose />
            <DialogTitle>운영자 등록</DialogTitle>
            <DialogDescription>
              <span className="text-gray-200 mt-2 block">
                최초 1회 소속 기업 정보(기업명 및 사업자등록 번호)를 검증한 후 운영자로 등록됩니다.
              </span>
              <span className="text-gray-200 mt-1 block">
                운영자로 등록되지 않은 경우, 본 Admin 화면에 로그인 및 접속이 불가합니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <PartnerRegistrationForm
              subdomain=""
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
