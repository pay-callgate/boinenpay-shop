/**
 * 뉴런 po-return(운영자·파트너용) 문구 — 문서 2.1.5·부록 A 참고.
 * 고객 쇼핑몰 마이페이지 안내는 사용하지 않음.
 */

/** 전화번호는 `.env`에만 두고 Git 미포함 — `NEXT_PUBLIC_WOORIBUGO_CS_TEL` */
export function wooribugoCustomerServiceLine(): string {
  const tel = process.env.NEXT_PUBLIC_WOORIBUGO_CS_TEL?.trim();
  if (tel) {
    return `동일 증상이 계속되면 우리부고 고객센터(${tel})로 연락해 주세요.`;
  }
  return "동일 증상이 계속되면 우리부고 고객센터로 연락해 주세요.";
}

export function newrunPoReturnHeadline(rwr_result: string): string {
  const r = rwr_result.trim();
  if (r === "0") return "발주가 정상 완료되었습니다.";
  if (r === "20") return "이미 접수된 주문번호입니다.";
  if (r === "99") return "일시적으로 처리할 수 없습니다.";
  if (r === "2" || r === "3" || r === "11") return "발주 처리 중 오류가 발생했습니다.";
  return "발주 처리 결과를 확인해 주세요.";
}

export function newrunPoReturnDetail(rwr_result: string): string {
  const r = rwr_result.trim();
  if (r === "0")
    return "뉴런(협회) 시스템에 정상 접수되었습니다. 파트너 어드민의 주문 상세에서 발주·협회 주문번호를 확인할 수 있습니다.";
  if (r === "20")
    return "동일 쇼핑몰 주문번호로 이미 접수된 건입니다. 어드민 주문 상세에서 중복 여부를 확인해 주세요.";
  if (r === "99")
    return "서버 또는 협회 시스템 연결에 문제가 있을 수 있습니다. 잠시 후 어드민에서 발주를 재시도해 보시고, 반복되면 아래 안내에 따라 문의해 주세요.";
  if (r === "2" || r === "3" || r === "11")
    return "입력값·협회 설정을 확인해 주세요. 어드민에서 발주 미리보기·필수 항목을 점검한 뒤 재시도해 보시고, 해결되지 않으면 아래 안내에 따라 문의해 주세요.";
  return `처리 코드: ${r}. 어드민 주문 상세와 뉴런 안내를 확인해 주세요.`;
}
