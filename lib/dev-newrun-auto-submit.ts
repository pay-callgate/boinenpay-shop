import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "dev-runtime", "newrun-auto-submit.json");

export type DevNewrunAutoSubmitFileShape = {
  /** 결제 완료(viewpay_complete) 시 뉴런 자동 발주 여부. 기본 true. */
  autoSubmitEnabled: boolean;
};

function isDevRuntime(): boolean {
  return process.env.NODE_ENV === "development";
}

function defaultState(): DevNewrunAutoSubmitFileShape {
  return { autoSubmitEnabled: true };
}

/**
 * 로컬 `next dev` 전용: 헤더 토글로 결제 직후 자동 발주 on/off.
 * 프로덕션에서는 항상 true(동작 변경 없음). 서버리스 배포 시 파일이 비어 있을 수 있으니 로컬 개발에 사용.
 */
export function getDevNewrunAutoSubmitEnabled(): boolean {
  if (!isDevRuntime()) return true;
  try {
    const raw = fs.readFileSync(FILE, "utf8");
    const j = JSON.parse(raw) as Partial<DevNewrunAutoSubmitFileShape>;
    if (typeof j.autoSubmitEnabled === "boolean") return j.autoSubmitEnabled;
  } catch {
    // 없거나 파싱 실패 → 기본 on
  }
  return defaultState().autoSubmitEnabled;
}

export function readDevNewrunAutoSubmitState(): DevNewrunAutoSubmitFileShape {
  return { autoSubmitEnabled: getDevNewrunAutoSubmitEnabled() };
}

export function writeDevNewrunAutoSubmitState(next: DevNewrunAutoSubmitFileShape): void {
  if (!isDevRuntime()) {
    throw new Error("개발 모드에서만 우리부고 자동 발주 토글을 저장할 수 있습니다.");
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export function isDevNewrunAutoSubmitToggleAvailable(): boolean {
  return isDevRuntime();
}
