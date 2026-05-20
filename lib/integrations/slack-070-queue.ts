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
    "*070 연동 요청 접수 안내(콜링크 쇼핑 --> 구글스프레드시트 신규 데이터 추가)*",
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

const C2W_COMPLETE_MESSAGE =
  "콜링크 서버에서 C2W 연동 완료 처리 결과를 정상 수신하여 시스템 처리 완료하였습니다.";

/**
 * Callcloud 시트 "완료" → 웹훅으로 DB 반영 완료 시 동일 Incoming Webhook으로 고정 안내 발송.
 * 클라이언트 식별자는 선택(마스킹된 짧은 id만 표시 가능).
 */
export async function postSlack070C2wCompleteNotice(opts?: {
  clientIdPrefix?: string;
}): Promise<void> {
  const url =
    process.env.SLACK_070_WEBHOOK_URL?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) {
    throw new Error(
      "SLACK_070_WEBHOOK_URL (또는 SLACK_WEBHOOK_URL) is not configured"
    );
  }

  const suffix = opts?.clientIdPrefix?.trim()
    ? `\n• 거래처 id: \`${opts.clientIdPrefix}…\``
    : "";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `${C2W_COMPLETE_MESSAGE}${suffix}` }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Slack webhook failed: HTTP ${res.status} ${body.slice(0, 240)}`);
  }
}
