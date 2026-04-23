/**
 * 파트너 어드민: 주문자 열 표시 — 비회원은 users 조인이 없어 별도 라벨 필요
 */

export type AdminOrdererOrderList = {
  user?: { name?: string | null } | null;
  is_guest?: boolean | null;
  orderer_name?: string | null;
};

export type AdminOrdererOrderDetail = AdminOrdererOrderList & {
  user?: { name?: string | null; email?: string | null } | null;
  shipping_phone?: string | null;
  guest_orderer_email?: string | null;
};

export function formatAdminOrdererListLabel(o: AdminOrdererOrderList): string {
  const n = o.user?.name?.trim();
  if (n) return n;
  const on = o.orderer_name?.trim();
  if (on) return on;
  if (o.is_guest) return "비회원";
  return "-";
}

/** 상세 카드: 이메일 없는 비회원은 배송 연락처로 안내 */
export function formatAdminOrdererDetailLine(o: AdminOrdererOrderDetail): string {
  if (o.user) {
    const name = o.user.name?.trim() || "-";
    const email = o.user.email?.trim() || "-";
    return `${name} (${email})`;
  }
  if (o.is_guest) {
    const on = o.orderer_name?.trim();
    const em = o.guest_orderer_email?.trim();
    const ph = o.shipping_phone?.trim() || "-";
    if (on) {
      const extra = em ? ` · ${em}` : "";
      return `비회원 · ${on}${extra} (연락처 ${ph})`;
    }
    return `비회원 (연락처 ${ph} · 회원 계정 없음)`;
  }
  return "- (-)";
}
