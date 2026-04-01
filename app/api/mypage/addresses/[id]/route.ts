import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { hasMypageClientAccess } from "@/lib/mypage-client-access";

/**
 * T6-3: 배송지 단건 — ?clientId= 필수 (거래처 격리)
 */

function getClientId(request: NextRequest): string {
  return request.nextUrl.searchParams.get("clientId")?.trim() ?? "";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const clientId = getClientId(request);
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const supabase = createServerSupabase();
    const allowed = await hasMypageClientAccess(
      supabase,
      session.user.id,
      clientId
    );
    if (!allowed) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { data: address, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      console.error("Address fetch error:", error);
      return NextResponse.json({ error: "배송지 조회 실패" }, { status: 500 });
    }
    if (!address) {
      return NextResponse.json(
        { error: "배송지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ address });
  } catch (err) {
    console.error("Address GET API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const clientId = getClientId(request);
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const { name, phone, postcode, address, detail, isDefault } =
      await request.json();

    if (!name || !phone || !address) {
      return NextResponse.json(
        { error: "배송지 정보를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const allowed = await hasMypageClientAccess(
      supabase,
      session.user.id,
      clientId
    );
    if (!allowed) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { data: existingAddress } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!existingAddress) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    if (isDefault) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", session.user.id)
        .eq("client_id", clientId)
        .eq("is_default", true)
        .neq("id", id);
    }

    const { data: updatedAddress, error } = await supabase
      .from("addresses")
      .update({
        name,
        phone,
        postcode:
          postcode != null && String(postcode).trim() !== ""
            ? String(postcode).trim()
            : "",
        address,
        detail: detail || null,
        is_default: isDefault || false,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Address update error:", error);
      return NextResponse.json({ error: "배송지 수정 실패" }, { status: 500 });
    }

    return NextResponse.json({
      address: updatedAddress,
      message: "배송지가 수정되었습니다.",
    });
  } catch (err) {
    console.error("Address PUT API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const clientId = getClientId(request);
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId가 필요합니다." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const supabase = createServerSupabase();
    const allowed = await hasMypageClientAccess(
      supabase,
      session.user.id,
      clientId
    );
    if (!allowed) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { data: existingAddress } = await supabase
      .from("addresses")
      .select("id")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (!existingAddress) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { error } = await supabase.from("addresses").delete().eq("id", id);

    if (error) {
      console.error("Address delete error:", error);
      return NextResponse.json({ error: "배송지 삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ message: "배송지가 삭제되었습니다." });
  } catch (err) {
    console.error("Address DELETE API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
