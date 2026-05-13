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

/** 스프레드시트 전체 URL 또는 `/edit?gid=0`가 붙은 값에서 ID만 추출 */
export function normalizeSpreadsheetId(raw: string): string {
  const t = raw.trim();
  const fromPath = t.match(/\/d\/([a-zA-Z0-9-_]{20,})/);
  if (fromPath) return fromPath[1];

  let s = t.split(/[?#]/)[0].trim();
  s = s.replace(/\/edit\/?$/i, "").trim();
  const segments = s.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? s;
  if (/^[a-zA-Z0-9-_]{20,}$/.test(last)) return last;
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return t;
}

function loadServiceAccountJson(): Record<string, unknown> {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64?.trim();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();

  if (b64) {
    let decoded: string;
    try {
      decoded = Buffer.from(b64, "base64").toString("utf8");
    } catch (e) {
      console.error("[google-sheets-070] GOOGLE_SERVICE_ACCOUNT_BASE64 Buffer decode failed", {
        err: e instanceof Error ? e.message : String(e),
        b64Length: b64.length,
      });
      throw new Error("GOOGLE_SERVICE_ACCOUNT_BASE64 디코딩에 실패했습니다.");
    }
    try {
      const creds = JSON.parse(decoded) as Record<string, unknown>;
      console.info("[google-sheets-070] service account loaded from BASE64", {
        decodedLength: decoded.length,
        hasClientEmail: typeof creds.client_email === "string",
      });
      return creds;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[google-sheets-070] GOOGLE_SERVICE_ACCOUNT_BASE64 JSON.parse failed", {
        err: msg,
        decodedLength: decoded.length,
      });
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_BASE64 내용이 올바른 JSON이 아닙니다: ${msg}`
      );
    }
  }

  if (raw) {
    try {
      const creds = JSON.parse(raw) as Record<string, unknown>;
      console.info("[google-sheets-070] service account loaded from GOOGLE_SERVICE_ACCOUNT_JSON", {
        rawLength: raw.length,
        hasClientEmail: typeof creds.client_email === "string",
      });
      return creds;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[google-sheets-070] GOOGLE_SERVICE_ACCOUNT_JSON JSON.parse failed", {
        err: msg,
        rawLength: raw.length,
        firstCharCode: raw.charCodeAt(0),
        secondCharCode: raw.length > 1 ? raw.charCodeAt(1) : null,
        hint:
          ".env에 JSON 전체를 넣을 때 앞뒤에 작은따옴표를 붙이면 실패합니다. Vercel/Windows 줄바꿈은 GOOGLE_SERVICE_ACCOUNT_BASE64 권장.",
      });
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_JSON 파싱 실패: ${msg}. Base64 변수로 넣거나 JSON을 한 줄·이스케이프된 private_key로 맞추세요.`
      );
    }
  }

  console.error("[google-sheets-070] no service account env (GOOGLE_SERVICE_ACCOUNT_JSON / _BASE64)");
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
  const rawId = process.env.GOOGLE_SHEETS_070_SPREADSHEET_ID?.trim();
  const sheetName = process.env.GOOGLE_SHEETS_070_TAB_NAME?.trim() || "070연동대기열";
  if (!rawId) {
    throw new Error("GOOGLE_SHEETS_070_SPREADSHEET_ID is not configured");
  }

  const spreadsheetId = normalizeSpreadsheetId(rawId);
  if (spreadsheetId !== rawId) {
    console.info("[google-sheets-070] spreadsheet id normalized (URL·쿼리 제거)", {
      rawTail: rawId.slice(-24),
      normalizedTail: spreadsheetId.slice(-8),
      normalizedLength: spreadsheetId.length,
    });
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

  try {
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });

    const updatedRange = res.data.updates?.updatedRange ?? null;
    console.info("[google-sheets-070] append ok", {
      spreadsheetIdTail: spreadsheetId.slice(-6),
      sheetName,
      updatedRange,
    });

    return { updatedRange };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const gaxios = e as { code?: number; errors?: unknown };
    console.error("[google-sheets-070] spreadsheets.values.append failed", {
      message: err.message,
      code: gaxios.code,
      errors: gaxios.errors,
      spreadsheetIdTail: spreadsheetId.slice(-6),
      range,
    });
    throw err;
  }
}
