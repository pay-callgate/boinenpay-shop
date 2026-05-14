"use client";

import { Users } from "lucide-react";

type UserRow = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type Props = {
  user: UserRow | null | undefined;
  isGuest?: boolean | null;
  ordererName?: string | null;
  guestOrdererEmail?: string | null;
  shippingPhone?: string | null;
  paymentMethod: string | null | undefined;
  paymentStatus: string;
  createdAt: string;
  formatDate: (iso: string) => string;
};

export function OrderOrdererCard({
  user,
  isGuest,
  ordererName,
  guestOrdererEmail,
  shippingPhone,
  paymentMethod,
  paymentStatus,
  createdAt,
  formatDate,
}: Props) {
  const name =
    user?.name?.trim() ||
    ordererName?.trim() ||
    (isGuest ? "비회원" : "—");
  const contact = user?.phone?.trim() || shippingPhone?.trim() || "—";
  const email = user?.email?.trim() || guestOrdererEmail?.trim() || "—";
  const paidLine = paymentStatus === "paid" ? formatDate(createdAt) : "—";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4 text-lg font-bold text-gray-900">
        <Users className="h-5 w-5 shrink-0 text-orange-500" aria-hidden />
        주문자 (결제) 정보
      </h2>
      <dl className="space-y-3">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">주문자</dt>
          <dd className="text-sm font-medium text-gray-900">{name}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">연락처</dt>
          <dd className="text-sm font-medium text-gray-900">{contact}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">이메일</dt>
          <dd className="break-all text-sm font-medium text-gray-900">{email}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">결제수단</dt>
          <dd className="text-sm font-medium text-gray-900">{paymentMethod ?? "—"}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-sm font-medium text-gray-500">결제일시</dt>
          <dd className="text-sm font-medium text-gray-900">{paidLine}</dd>
        </div>
      </dl>
    </section>
  );
}
