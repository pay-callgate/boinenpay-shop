import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 세션 user_id가 해당 partner_id에 연결된 partner_admins 행이 있는지 확인.
 */
export async function requirePartnerAccess(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data } = await supabase
    .from("partner_admins")
    .select("partner_id")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }),
    };
  }
  return { ok: true };
}
