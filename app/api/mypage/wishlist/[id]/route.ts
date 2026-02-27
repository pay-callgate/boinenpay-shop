import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T6-5: 관심상품 삭제 API
 * DELETE /api/mypage/wishlist/[id] - 관심상품 삭제
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;

    const supabase = createServerSupabase();

    // 권한 검증
    const { data: item } = await supabase
      .from("wishlist_items")
      .select("*")
      .eq("id", id)
      .single();

    if (!item || item.user_id !== session.user.id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    // 관심상품 삭제
    const { error } = await supabase.from("wishlist_items").delete().eq("id", id);

    if (error) {
      console.error("Wishlist delete error:", error);
      return NextResponse.json({ error: "관심상품 삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ message: "관심상품에서 삭제되었습니다." });
  } catch (err) {
    console.error("Wishlist DELETE API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
