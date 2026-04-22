import { NewrunPoReturnView } from "@/components/admin/NewrunPoReturnView";
import { applyNewrunPoReturnFromSearchParams } from "@/lib/newrun/apply-po-return";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * 뉴런 `rw_returnurl` 브라우저 착지 — 파트너·운영자용(쇼핑몰 고객 화면 아님).
 * `NEWRUN_RW_RETURNURL` 예: https://도메인/admin/newrun/po-return
 */
export default async function AdminNewrunPoReturnPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  let apply: Awaited<ReturnType<typeof applyNewrunPoReturnFromSearchParams>> | null =
    null;

  try {
    const supabase = createServerSupabase();
    apply = await applyNewrunPoReturnFromSearchParams(supabase, sp);
  } catch {
    apply = {
      kind: "skipped",
      reason: "db_error",
      message: "일시적으로 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  const paramLines = Object.entries(sp).flatMap(([k, v]) =>
    Array.isArray(v) ? v.map((x) => `${k}=${x}`) : [`${k}=${v ?? ""}`]
  );

  return <NewrunPoReturnView apply={apply} paramLines={paramLines} />;
}
