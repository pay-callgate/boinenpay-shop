import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { hashMemberPassword } from "@/lib/member-password";

export const dynamic = "force-dynamic";

/**
 * 이메일(아이디) + 비밀번호 회원가입 (쇼핑몰 고객).
 * POST /api/shop/register
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim() || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: { message: "올바른 이메일을 입력해 주세요." } },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { message: "비밀번호는 8자 이상이어야 합니다." } },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data: dup } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (dup) {
      return NextResponse.json(
        { success: false, error: { message: "이미 가입된 이메일입니다." } },
        { status: 409 }
      );
    }

    const password_hash = hashMemberPassword(password);
    const { data: row, error } = await supabase
      .from("users")
      .insert({
        email,
        name,
        password_hash,
        provider: "credentials",
        provider_id: email,
        role: "end_customer",
        profile_completed: false,
        terms_agreed: false,
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("[shop/register]", error);
      return NextResponse.json(
        { success: false, error: { message: "가입 처리에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { userId: row.id } });
  } catch (e) {
    console.error("[shop/register]", e);
    return NextResponse.json(
      { success: false, error: { message: "서버 오류" } },
      { status: 500 }
    );
  }
}
