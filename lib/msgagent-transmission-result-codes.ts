/**
 * SMTNT Agent2 Webshot 연동 매뉴얼 [전송결과] 시트 — 리포트 API `result` 필드.
 * API [결과코드](`result_code`)와 별도입니다.
 */

export const MSGAGENT_TRANSMISSION_RESULT_CODE_LABEL: Record<number, string> = {
  0: "성공",
  1: "API버전오류",
  2: "인증실패",
  3: "BIND 미수행",
  4: "호스팅 시스템 내부오류",
  5: "메시지 형식 오류",
  6: "유효기간 만료",
  7: "결번",
  8: "단말기 Power Off",
  9: "음영",
  10: "전송건수 초과",
  11: "전송속도 초과",
  12: "번호이동",
  13: "NPDB 불일치",
  14: "호 처리 실패",
  15: "단말기 전송 실패",
  16: "파일이 없음",
  17: "키사 스팸 차단",
  18: "전달 메시지 없음",
  19: "압축 데이터 오류",
  20: "메시지 저장개수 초과",
  21: "잘못된 파라미터",
  22: "발신 프로필 키가 유효하지 않음",
  23: "발신 프로필을 찾을 수 없음",
  24: "삭제된 발신프로필",
  25: "차단 상태의 발신프로필",
  26: "차단 상태의 옐로아이디",
  27: "닫힘 상태의 옐로아이디",
  28: "삭제 상태의 옐로아이디",
  29: "메시지 전송 실패",
  30: "템플릿 일치 확인 시 오류",
  31: "메시지 수신확인 안됨",
  32: "내부 시스템 오류",
  33: "전화번호 오류",
  35: "메시지 길이 제한 오류",
  36: "템플릿을 찾을 수 없음",
  37: "메시지에 포함된 이미지를 전송할 수 없음",
  38: "메시지 버튼이 템플릿과 일치하지 않음",
  315: "세션 미접속",
  316: "발신번호 미등록",
  317: "발신번호 변작으로 등록된 발신번호",
  318: "번호도용문자 차단서비스에 가입된 번호",
  800: "발송메시지에 허용 되지 않은 문구가 포함됨",
  900: "대량전송 월셋건수 초과",
  901: "발송 가능시간이 아님",
  902: "로그인 상태가 아님",
  903: "발송속도 초과",
  904: "월 제한건수 초과",
  905: "일 제한건수 초과",
  906: "보유 금액 부족",
  907: "시스템 과부하",
  908: "특정필드가 허용된 길이를 초과함",
  909: "첨부파일 파일갯수 오류",
  910: "첨부파일 크기 오류",
  911: "수신제외 오류입니다.",
};

export function parseTransmissionResultCode(
  value: unknown
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

export function isTransmissionResultSuccess(code: number | null): boolean {
  return code === 0;
}

export function getTransmissionResultCodeLabel(
  code: string | number | null | undefined
): string | null {
  const n = parseTransmissionResultCode(code);
  if (n === null) return null;
  return MSGAGENT_TRANSMISSION_RESULT_CODE_LABEL[n] ?? null;
}

export function formatTransmissionResultForAdminDisplay(
  code: string | null | undefined,
  message?: string | null
): string {
  const c = code != null ? String(code).trim() : "";
  const msg = message != null ? String(message).trim() : "";
  if (!c && !msg) return "—";
  const label = c ? getTransmissionResultCodeLabel(c) : null;
  const codePart = c
    ? label
      ? `${c} · ${label}`
      : `${c} · (매뉴얼 미등록)`
    : "";
  if (msg && codePart) return `${codePart} — ${msg}`;
  return msg || codePart || "—";
}
