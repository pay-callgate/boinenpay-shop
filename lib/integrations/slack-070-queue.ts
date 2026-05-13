/**
 * 070 연동 접수 알림 — Incoming Webhook
 * 환경변수: SLACK_070_WEBHOOK_URL (Vercel 시크릿, 코드에 하드코딩 금지)
 */

export async function postSlack070QueueNotification(opts: {
  clientName: string;
  clientId: string;
  sheetRow: number | null;
  spreadsheetId: string;
}): Promise<void> {
  const url =
    process.env.SLACK_070_WEBHOOK_URL?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) {
    throw new Error(
      "SLACK_070_WEBHOOK_URL (또는 SLACK_WEBHOOK_URL) is not configured"
    );
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${opts.spreadsheetId}/edit`;
  const rowHint = opts.sheetRow
    ? `시트 *${opts.sheetRow}번째 줄*에 새 연동 요청 행이 추가되었습니다.`
    : "구글 시트에 새 행이 추가되었습니다. (행 번호는 시트에서 확인해 주세요)";

  const text = [
    "*070 연동 요청 (CallLink → 시트·슬랙)*",
    `• 거래처: *${opts.clientName}* (\`${opts.clientId}\`)`,
    `• ${rowHint}`,
    `• 시트 열기: ${sheetUrl}`,
  ].join("\n");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Slack webhook failed: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
}
