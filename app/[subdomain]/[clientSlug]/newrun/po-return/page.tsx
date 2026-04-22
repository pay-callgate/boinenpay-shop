import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * 하위 호환: 기존 쇼핑몰 경로 → 파트너 전용 `/admin/newrun/po-return`으로 동일 쿼리 이전.
 * `NEWRUN_RW_RETURNURL`은 `/admin/newrun/po-return` 사용을 권장한다.
 */
export default async function LegacyShopNewrunPoReturnRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const v of val) q.append(key, v);
    } else {
      q.append(key, val);
    }
  }
  const suffix = q.toString();
  redirect(suffix ? `/admin/newrun/po-return?${suffix}` : "/admin/newrun/po-return");
}
