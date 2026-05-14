/**
 * 어드민 모달 UI 정책 (고객사 Link 안내 메시지 · LinkNotificationModal 기준)
 *
 * - 헤더 배경과 Primary CTA 배경을 동일 색으로 통일 (#1e293b)
 * - 취소: 흰 배경 + 테두리
 *
 * 새 어드민 Dialog·모달은 이 모듈의 클래스를 사용합니다.
 */

export const ADMIN_MODAL_HEADER_BG_CLASS = "bg-[#1e293b]";

/** p-0 DialogContent용 상단 헤더 블록 (제목·닫기 등) */
export const ADMIN_MODAL_HEADER_BAR_CLASS = `relative shrink-0 ${ADMIN_MODAL_HEADER_BG_CLASS} px-6 pb-4 pt-6`;

/** DialogFooter·일반 폼 Primary */
export const ADMIN_MODAL_PRIMARY_BTN_CLASS =
  "rounded-lg bg-[#1e293b] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

/** 발신·수신 행의 「수정」 등 소형 Primary */
export const ADMIN_MODAL_PRIMARY_BTN_SM_CLASS =
  "rounded-lg bg-[#1e293b] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50";

export const ADMIN_MODAL_CANCEL_BTN_CLASS =
  "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50";

/** Link 안내 모달 하단: 긴 한글 레이블이 잘리지 않도록 whitespace-nowrap + 최소 너비 */
export const ADMIN_MODAL_FOOTER_PRIMARY_BTN_CLASS =
  "inline-flex min-h-10 w-max min-w-[12rem] max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#1e293b] px-4 text-center text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-900 disabled:opacity-60";

export const ADMIN_MODAL_FOOTER_CANCEL_BTN_CLASS =
  "inline-flex min-h-10 w-max min-w-[12rem] max-w-full shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50";

/** Partner 온보딩 등 h-11 제출 버튼 */
export const ADMIN_MODAL_PRIMARY_FORM_SUBMIT_CLASS =
  "h-11 cursor-pointer rounded-lg border-0 bg-[#1e293b] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60";
