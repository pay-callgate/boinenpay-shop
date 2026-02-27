import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T3-2: 거래처 상세 API
 * GET /api/clients/[id] - 단일 거래처 조회
 * PUT /api/clients/[id] - 거래처 수정
 * DELETE /api/clients/[id] - 거래처 삭제
 */

// GET: 단일 거래처 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    const { data: client, error } = await supabase
      .from("clients")
      .select("*, client_call_070_configs(*)")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        { error: "거래처를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ client });
  } catch (err) {
    console.error("Client GET error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT: 거래처 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      slug,
      logoUrl,
      businessRegistrationNumber,
      verificationStatus,
      contactName,
      contactPhone,
      contactEmail,
      zipCode,
      address,
      addressDetail,
    } = body;

    const supabase = createServerSupabase();

    // 기존 거래처 확인
    const { data: existing } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "거래처를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // slug 중복 검사 (자기 자신 제외)
    if (slug && slug !== existing.slug) {
      const { data: duplicateSlug } = await supabase
        .from("clients")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();

      if (duplicateSlug) {
        return NextResponse.json(
          { error: "동일한 slug가 이미 존재합니다." },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (logoUrl !== undefined) updateData.logo_url = logoUrl;
    if (businessRegistrationNumber !== undefined)
      updateData.business_registration_number = businessRegistrationNumber;
    if (verificationStatus !== undefined)
      updateData.verification_status = verificationStatus;
    if (contactName !== undefined) updateData.contact_name = contactName;
    if (contactPhone !== undefined) updateData.contact_phone = contactPhone;
    if (contactEmail !== undefined) updateData.contact_email = contactEmail;
    if (zipCode !== undefined) updateData.zip_code = zipCode;
    if (address !== undefined) updateData.address = address;
    if (addressDetail !== undefined) updateData.address_detail = addressDetail;

    const { data: client, error } = await supabase
      .from("clients")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Client update error:", error);
      return NextResponse.json(
        { error: "거래처 수정 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ client });
  } catch (err) {
    console.error("Client PUT error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 거래처 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerSupabase();

    // 주문 내역 확인
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("client_id", id)
      .limit(1);

    if (orders && orders.length > 0) {
      return NextResponse.json(
        { error: "주문 내역이 있는 거래처는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    // 070 설정 삭제
    await supabase.from("client_call_070_configs").delete().eq("client_id", id);

    // user_clients 매핑 삭제
    await supabase.from("user_clients").delete().eq("client_id", id);

    // 거래처 삭제
    const { error } = await supabase.from("clients").delete().eq("id", id);

    if (error) {
      console.error("Client delete error:", error);
      return NextResponse.json(
        { error: "거래처 삭제 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Client DELETE error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
