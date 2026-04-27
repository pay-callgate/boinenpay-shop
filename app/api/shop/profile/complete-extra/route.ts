import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("10")) return d;
  if (d.length === 11 && d.startsWith("010")) return d;
  if (d.length === 10) return d;
  if (d.length === 11) return d;
  return raw.trim();
}

function isValidKrMobile(phone: string): boolean {
  const d = phone.replace(/\D/g, "");
  return /^01[0-9]\d{7,8}$/.test(d);
}

/**
 * 소셜/이메일 가입 후 추가 정보: 휴대폰 + 필수 약관.
 * POST /api/shop/profile/complete-extra
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { message: "로그인이 필요합니다." } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const phone = normalizePhone(String(body.phone ?? ""));
    const termsAgreed = body.termsAgreed === true;

    if (!phone || !isValidKrMobile(phone)) {
      return NextResponse.json(
        { success: false, error: { message: "휴대폰 번호를 확인해 주세요." } },
        { status: 400 }
      );
    }
    if (!termsAgreed) {
      return NextResponse.json(
        { success: false, error: { message: "필수 약관에 동의해 주세요." } },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("users")
      .update({
        phone,
        terms_agreed: true,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (error) {
      console.error("[complete-extra]", error);
      return NextResponse.json(
        { success: false, error: { message: "저장에 실패했습니다." } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[complete-extra]", e);
    return NextResponse.json(
      { success: false, error: { message: "서버 오류" } },
      { status: 500 }
    );
  }
}
