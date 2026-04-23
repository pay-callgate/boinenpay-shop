/**
 * 파트너 어드민 — 카카오 알림톡 발송 내역 (스텁 + 필터 유틸).
 * TODO: GET /api/admin/messages 에서 link_kakao_notifications 등 실제 테이블과 매핑.
 */

export type AdminAlimtalkHistoryStatus =
  | "completed"
  | "scheduled"
  | "sending"
  | "failed";

export interface AdminAlimtalkMessageRow {
  id: string;
  partnerId: string;
  sentAt: string;
  clientName: string;
  recipientName: string;
  recipientPhone: string;
  title: string;
  body: string;
  status: AdminAlimtalkHistoryStatus;
  totalCount: number;
  successCount: number;
  failCount: number;
  senderPhone: string;
}

export const ADMIN_ALIMTALK_UNIT_WON = 4;

export const ADMIN_ALIMTALK_STATUS_LABEL: Record<
  AdminAlimtalkHistoryStatus,
  string
> = {
  completed: "완료",
  scheduled: "예약",
  sending: "발송 중",
  failed: "불가",
};

/** 데모용 스텁 — API에서 세션의 partnerId로 덮어씀 */
export const ADMIN_ALIMTALK_MESSAGES_STUB: Omit<
  AdminAlimtalkMessageRow,
  "partnerId"
>[] = [
  {
    id: "stub-1",
    sentAt: "2026-03-28T14:32:00+09:00",
    clientName: "플라워갤러리 강남점",
    recipientName: "이민정",
    recipientPhone: "01012345678",
    title: "고객사 Link 안내",
    body: `안녕하세요.

화면으로 바로 주문하는
플라워갤러리 강남점 콜링크 쇼핑입니다.

요청하신 서비스 이용을 위해 아래의 링크를 눌러 접속해 주세요.
https://example.com/wooribugo/flower-gangnam

감사합니다.`,
    status: "completed",
    totalCount: 1,
    successCount: 1,
    failCount: 0,
    senderPhone: "07012345678",
  },
  {
    id: "stub-2",
    sentAt: "2026-03-29T09:15:00+09:00",
    clientName: "꽃마을 종로",
    recipientName: "박대리",
    recipientPhone: "01098765432",
    title: "고객사 Link 안내",
    body: `안녕하세요.

화면으로 바로 주문하는
꽃마을 종로 콜링크 쇼핑입니다.

요청하신 서비스 이용을 위해 아래의 링크를 눌러 접속해 주세요.
https://example.com/wooribugo/jongno

감사합니다.`,
    status: "scheduled",
    totalCount: 50,
    successCount: 0,
    failCount: 0,
    senderPhone: "07012345678",
  },
  {
    id: "stub-3",
    sentAt: "2026-03-30T11:00:00+09:00",
    clientName: "로즈가든",
    recipientName: "김과장",
    recipientPhone: "01055551234",
    title: "고객사 Link 안내",
    body: "대량 발송 배치 처리 중입니다.",
    status: "sending",
    totalCount: 120,
    successCount: 80,
    failCount: 0,
    senderPhone: "07012345678",
  },
  {
    id: "stub-4",
    sentAt: "2026-03-30T16:45:00+09:00",
    clientName: "스프링플라워",
    recipientName: "최팀장",
    recipientPhone: "01011112222",
    title: "고객사 Link 안내",
    body: "템플릿 불일치로 발송에 실패했습니다. (스텁)",
    status: "failed",
    totalCount: 1,
    successCount: 0,
    failCount: 1,
    senderPhone: "07012345678",
  },
];

export interface AdminAlimtalkFilterParams {
  fromIso: string | null;
  toIso: string | null;
  status: AdminAlimtalkHistoryStatus | "all";
  q: string;
}

function parseDayStart(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDayEnd(iso: string): Date {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function filterAdminAlimtalkRows(
  rows: AdminAlimtalkMessageRow[],
  p: AdminAlimtalkFilterParams
): AdminAlimtalkMessageRow[] {
  let out = rows;

  if (p.fromIso) {
    const from = parseDayStart(p.fromIso);
    out = out.filter((r) => new Date(r.sentAt) >= from);
  }
  if (p.toIso) {
    const to = parseDayEnd(p.toIso);
    out = out.filter((r) => new Date(r.sentAt) <= to);
  }
  if (p.status !== "all") {
    out = out.filter((r) => r.status === p.status);
  }
  const qq = p.q.trim().toLowerCase();
  if (qq) {
    out = out.filter(
      (r) =>
        r.clientName.toLowerCase().includes(qq) ||
        r.recipientName.toLowerCase().includes(qq) ||
        r.recipientPhone.replace(/\D/g, "").includes(qq.replace(/\D/g, ""))
    );
  }

  return out.sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );
}

export function summarizeAlimtalkSettlement(rows: AdminAlimtalkMessageRow[]): {
  totalSuccessCount: number;
  estimatedSettlementWon: number;
} {
  const totalSuccessCount = rows.reduce((s, r) => s + r.successCount, 0);
  return {
    totalSuccessCount,
    estimatedSettlementWon: totalSuccessCount * ADMIN_ALIMTALK_UNIT_WON,
  };
}
