import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * T3-1, T3-2: 거래처 API
 * GET /api/clients?partnerId=xxx - 거래처 목록 조회
 * POST /api/clients - 거래처 생성
 */

// GET: 거래처 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");

    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { data: clients, error } = await supabase
      .from("clients")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Clients fetch error:", error);
      return NextResponse.json(
        { error: "거래처 조회 실패" },
        { status: 500 }
      );
    }

    const list = clients || [];
    const clientIds = list.map((c: { id: string }) => c.id);

    // 070 연동 번호 별도 조회 (조인 미지원 시 대비)
    let configsByClientId: Record<string, string> = {};
    if (clientIds.length > 0) {
      const { data: configs } = await supabase
        .from("client_call_070_configs")
        .select("client_id, call_070_number")
        .in("client_id", clientIds);
      configsByClientId = (configs || []).reduce(
        (acc: Record<string, string>, row: { client_id: string; call_070_number: string | null }) => {
          if (row.call_070_number?.trim()) acc[row.client_id] = row.call_070_number.trim();
          return acc;
        },
        {}
      );
    }

    const clientsWith070 = list.map((c: { id: string; [key: string]: unknown }) => ({
      ...c,
      client_call_070_configs: configsByClientId[c.id]
        ? [{ call_070_number: configsByClientId[c.id] }]
        : [],
    }));

    return NextResponse.json({ clients: clientsWith070 });
  } catch (err) {
    console.error("Clients API error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 거래처 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      partnerId,
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

    if (!partnerId || !name || !slug) {
      return NextResponse.json(
        { error: "partnerId, name, slug는 필수입니다." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // slug 중복 검사 (전체 clients에서)
    const { data: existingSlug } = await supabase
      .from("clients")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingSlug) {
      return NextResponse.json(
        { error: "동일한 slug가 이미 존재합니다." },
        { status: 409 }
      );
    }

    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        partner_id: partnerId,
        name,
        slug,
        logo_url: logoUrl || null,
        business_registration_number: businessRegistrationNumber || null,
        verification_status: verificationStatus || "pending",
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        zip_code: zipCode || null,
        address: address || null,
        address_detail: addressDetail || null,
        call_070_connected: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Client create error:", error);
      return NextResponse.json(
        { error: "거래처 생성 실패" },
        { status: 500 }
      );
    }

    return NextResponse.json({ client }, { status: 201 });
  } catch (err) {
    console.error("Clients POST error:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
