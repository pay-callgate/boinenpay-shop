/**
 * CallLink 연동 번호 UI·알림톡 표기
 * - 070 (11자리): 070-XXXX-XXXX
 * - 050 (12자리): 0508-XXXX-XXXX
 */
export function formatCallLinkPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 11 && digits.startsWith("070")) {
    return `070-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length >= 12 && digits.startsWith("050")) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  return raw.trim();
}
