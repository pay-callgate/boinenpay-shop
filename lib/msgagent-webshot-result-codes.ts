/**
 * SMTNT Agent2 Webshot 연동 매뉴얼 [결과코드] 시트 기준 라벨.
 * 문서 버전 차이로 코드 의미가 바뀌는 경우(예: 100번대)는 최신 매뉴얼에 맞게 갱신하세요.
 */

export const MSGAGENT_WEBSHOT_RESULT_CODE_LABEL: Record<number, string> = {
  0: "성공",
  100: "허용되지 않은 형식",
  101: "허용되지 않은 아이피",
  102: "허용되지 않은 IP 주소",
  103: "허용되지 않은 사용자 아이디",
  200: "필수 요청 값 누락",
  300: "잘못된 요청 값",
  301: "잘못된 요청 값(메시지 타입)",
  302: "잘못된 요청 값(카카오 광고)",
  304: "잘못된 요청 값(전송시간)",
  305: "잘못된 요청 값(휴대전화번호)",
  306: "잘못된 요청 값(데이터가 존재하지 않음)",
  307: "잘못된 요청 값(즉시발송여부)",
  308: "잘못된 요청 값(메시지 아이디 숫자 형식 오류)",
  309: "잘못된 요청 값(재판매사 식별코드 숫자 형식 오류)",
  400: "데이터 길이 제한 초과",
  401: "데이터 길이 제한 초과(제목)",
  402: "데이터 길이 제한 초과(내용)",
  403: "데이터 길이 제한 초과(대체)",
  404: "전송 리스트 제한 초과",
  405: "리포트 리스트 제한 초과",
  600: "JSON 파싱 오류",
  700: "파일 오류",
  701: "파일 개수 값 오류",
  702: "파일 누락",
  703: "파일 형식 오류",
  704: "이미지 파일 크기 오류",
  705: "파일 용량 오류",
  800: "잘못된 접근",
  801: "잘못된 접근(http)",
  802: "타임 아웃",
  803: "당일 발송 데이터 없음",
  999: "시스템 오류",
};

/** 숫자로 해석 가능하면 매뉴얼 설명, 아니면 null */
export function getMsgagentWebshotResultCodeLabel(
  code: string | number | null | undefined
): string | null {
  if (code === null || code === undefined) return null;
  const n = Number(String(code).trim());
  if (!Number.isFinite(n)) return null;
  return MSGAGENT_WEBSHOT_RESULT_CODE_LABEL[n] ?? null;
}

/** 어드민 표기용: `306 · 데이터 없음…` / 미등록 코드 / 빈 값 */
export function formatMsgagentResultCodeForAdminDisplay(
  code: string | null | undefined
): string {
  const c = code != null ? String(code).trim() : "";
  if (!c) return "—";
  const label = getMsgagentWebshotResultCodeLabel(c);
  if (label) return `${c} · ${label}`;
  return `${c} · (매뉴얼 미등록)`;
}
