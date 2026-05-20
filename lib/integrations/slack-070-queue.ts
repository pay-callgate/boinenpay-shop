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
    "*070 연동 요청 접수 안내(콜링크 쇼핑 → 구글스프레드시트 신규 데이터 추가)*",
    "",
    `• 거래처: *${opts.clientName}* (${opts.clientId})`,
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

/**
 * Callcloud 시트 "완료" → 웹훅으로 DB 반영 완료 시 동일 Incoming Webhook으로 안내 발송.
 */
export async function postSlack070C2wCompleteNotice(opts: {
  clientName: string;
  clientId: string;
}): Promise<void> {
  const url =
    process.env.SLACK_070_WEBHOOK_URL?.trim() ||
    process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) {
    throw new Error(
      "SLACK_070_WEBHOOK_URL (또는 SLACK_WEBHOOK_URL) is not configured"
    );
  }

  const name = opts.clientName.trim() || "(이름 없음)";
  const text = [
    "*070 연동 완료 안내(콜링크 쇼핑, Call2Web 모두 등록 완료)*",
    "",
    `• 거래처: *${name}* (${opts.clientId})`,
    "",
    "• 응답메세지 : 콜링크 서버에서 C2W 등록 완료 결과를 정상 수신하였습니다.",
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
