/** 070 request-queue: 신규 연동 vs 정보 변경 */
export type Call070QueueKind = "new" | "update";

export function resolveCall070QueueKind(params: {
  isUpdateRequested?: boolean;
  callcloudRegistered?: boolean | null;
  call070Connected?: boolean | null;
}): Call070QueueKind {
  if (params.isUpdateRequested === true) return "update";
  if (params.callcloudRegistered === true && params.call070Connected === true) {
    return "update";
  }
  return "new";
}
