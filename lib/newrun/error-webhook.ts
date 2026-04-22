/**
 * 뉴런 발주 실패·오류 시 외부 Webhook (n8n 등) 알림 — Phase 8.5.2
 * NEWRUN_ERROR_WEBHOOK_URL 미설정 시 no-op
 */

export type NewrunErrorWebhookPayload = {
  order_no: string;
  error_code: string;
  error_message: string;
  timestamp: string;
};

/** 비차단: await 하지 않음. 실패는 삼킴 */
export function fireNewrunErrorWebhook(payload: NewrunErrorWebhookPayload): void {
  const url = process.env.NEWRUN_ERROR_WEBHOOK_URL?.trim();
  if (!url) return;

  const body = JSON.stringify({
    order_no: payload.order_no,
    error_code: payload.error_code,
    error_message: payload.error_message.slice(0, 4000),
    timestamp: payload.timestamp || new Date().toISOString(),
  });

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    /* webhook은 베스트에포트 */
  });
}
