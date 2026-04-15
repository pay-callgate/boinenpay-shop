/**
 * 카카오 알림톡 대량 발송용 — Excel/CSV 수신자 목록 파싱 (클라이언트)
 */
import * as XLSX from "xlsx";

export type ParsedRecipient = { phone: string; name?: string };

const PHONE_HINTS = [
  "phone",
  "전화",
  "휴대폰",
  "수신번호",
  "연락처",
  "mobile",
  "cell",
];
const NAME_HINTS = ["name", "이름", "성명", "수신자"];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function findCol(headers: string[], hints: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = norm(headers[i]);
    for (const hint of hints) {
      if (h === hint || h.includes(hint)) return i;
    }
  }
  return -1;
}

/** 앞자리 0 누락(엑셀 등) 보정 — kakaotest index.html normalizeKrPhone 과 동일 */
function normalizeKrPhoneDigits(rawDigits: string): string {
  let d = rawDigits.replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 && d.startsWith("10")) d = `0${d}`;
  if (d.length === 9 && d.startsWith("1")) d = `0${d}`;
  return d;
}

/** 첫 행이 헤더인지(순수 전화번호만 있으면 데이터 행으로 간주) */
function looksLikeHeaderRow(row: unknown[]): boolean {
  const first = String(row[0] ?? "").trim();
  if (!first) return false;
  const digits = first.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 11) return false;
  return true;
}

export function parseRecipientsFromBuffer(buf: ArrayBuffer): ParsedRecipient[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][];

  if (!aoa.length) return [];

  let startRow = 0;
  let phoneCol = 0;
  let nameCol = -1;

  const firstRow = aoa[0] as unknown[];
  if (looksLikeHeaderRow(firstRow)) {
    const headers = firstRow.map((c) => String(c ?? "").trim());
    phoneCol = findCol(headers, PHONE_HINTS);
    if (phoneCol < 0) phoneCol = 0;
    nameCol = findCol(headers, NAME_HINTS);
    if (nameCol < 0 && headers.length > 1) nameCol = 1;
    startRow = 1;
  } else {
    if (firstRow.length > 1) nameCol = 1;
  }

  const seen = new Set<string>();
  const out: ParsedRecipient[] = [];

  for (let r = startRow; r < aoa.length; r++) {
    const row = aoa[r] as unknown[];
    if (!row?.length) continue;
    const rawPhone = String(row[phoneCol] ?? "").trim();
    const rawDigits = rawPhone.replace(/\D/g, "");
    const digits = normalizeKrPhoneDigits(rawDigits);
    if (digits.length < 10 || digits.length > 11) continue;

    if (seen.has(digits)) continue;
    seen.add(digits);

    const name =
      nameCol >= 0
        ? String(row[nameCol] ?? "").trim() || undefined
        : undefined;
    out.push({ phone: digits, name });
  }

  return out;
}

export function parseRecipientsFromFile(file: File): Promise<ParsedRecipient[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        resolve(parseRecipientsFromBuffer(buf));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsArrayBuffer(file);
  });
}
