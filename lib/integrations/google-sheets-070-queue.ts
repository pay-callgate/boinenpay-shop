import { google } from "googleapis";

export type Append070QueueRowInput = {
  /** 표시용 접수 시각 (예: KST yyyy-MM-dd HH:mm:ss) */
  requestedAtKst: string;
  clientId: string;
  clientName: string;
  call070Number: string;
  greetingMessage: string;
  industry: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  serviceUrl: string;
  smsTextTemplate: string;
};

/** GAS CONFIG와 동일: A~M 데이터, N=진행상태, O=완료일자(빈 값) */
export function build070QueueRowValues(input: Append070QueueRowInput): string[] {
  return [
    input.requestedAtKst,
    input.clientId,
    input.clientName,
    input.call070Number,
    input.greetingMessage,
    input.call070Number,
    input.industry,
    input.adminName,
    input.adminEmail,
    input.adminPhone,
    input.serviceUrl,
    input.smsTextTemplate,
    "",
    "연동 대기",
    "",
  ];
}

export function parseSheetAppendedRow(updatedRange: string | null | undefined): number | null {
  if (!updatedRange) return null;
  const m = updatedRange.match(/![A-Za-z]+(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function loadServiceAccountJson(): Record<string, unknown> {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (b64) {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as Record<string, unknown>;
  }
  if (raw) {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  throw new Error(
    "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_BASE64 for Sheets API"
  );
}

/**
 * 시트 맨 아래에 행 추가 (append)
 * 시트는 서비스 계정 이메일에 편집 권한이 공유되어 있어야 함.
 */
export async function append070QueueRow(
  input: Append070QueueRowInput
): Promise<{ updatedRange: string | null }> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_070_SPREADSHEET_ID?.trim();
  const sheetName = process.env.GOOGLE_SHEETS_070_TAB_NAME?.trim() || "070연동대기열";
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_070_SPREADSHEET_ID is not configured");
  }

  const credentials = loadServiceAccountJson();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const escaped = sheetName.replace(/'/g, "''");
  const range = `'${escaped}'!A:O`;

  const values = build070QueueRowValues(input);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });

  return { updatedRange: res.data.updates?.updatedRange ?? null };
}
