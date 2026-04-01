import { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = ReturnType<typeof createServerSupabase>;

/**
 * 마이페이지(회원정보·배송지 등) 거래처 단위 접근 — 프로필 API와 동일 조건
 * user_clients 매칭 또는 해당 거래처 주문 이력
 */
export async function hasMypageClientAccess(
  supabase: ServerSupabase,
  userId: string,
  clientId: string
): Promise<boolean> {
  const [userClientsRes, ordersRes] = await Promise.all([
    supabase
      .from("user_clients")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .limit(1),
  ]);
  const isMember = !!userClientsRes.data;
  const hasOrder =
    Array.isArray(ordersRes.data) && ordersRes.data.length > 0;
  return isMember || hasOrder;
}

/**
 * user_clients 에 해당 거래처가 있는지 (장바구니·주문 등: 주문 이력 없이 소속만 허용)
 */
export async function userBelongsToClient(
  supabase: ServerSupabase,
  userId: string,
  clientId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("user_clients")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  return !!data;
}

/** client 존재 여부 (UUID 검증용) */
export async function getClientRow(
  supabase: ServerSupabase,
  clientId: string
): Promise<{ id: string; partner_id: string } | null> {
  const { data } = await supabase
    .from("clients")
    .select("id, partner_id")
    .eq("id", clientId)
    .maybeSingle();
  return data ?? null;
}
