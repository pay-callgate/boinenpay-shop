import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { viewpayPost, clearViewpayTokenCache } from "@/lib/viewpay";

/**
 * Phase B3: 결제 정보 조회 (ViewPay get-payment-info)
 * GET /api/payment/viewpay/info?cgTid=xxx&orderId=yyy
 * POST /api/payment/viewpay/info body: { cgTid, orderId? }
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cgTid = searchParams.get("cgTid");
  const orderId = searchParams.get("orderId");
  return handleInfo(cgTid ?? undefined, orderId ?? undefined);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { cgTid, orderId } = body;
    return handleInfo(
      typeof cgTid === "string" ? cgTid : undefined,
      typeof orderId === "string" ? orderId : undefined
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "cgTid 필수입니다." },
      { status: 400 }
    );
  }
}

async function handleInfo(cgTid: string | undefined, orderId: string | undefined) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 });
    }

    if (!cgTid?.trim()) {
      return NextResponse.json(
        { success: false, message: "cgTid 필수입니다." },
        { status: 400 }
      );
    }

    const result = await viewpayPost("/v1/gw/get-payment-info", {
      cgTid: cgTid.trim(),
      ...(orderId?.trim() ? { orderId: orderId.trim() } : {}),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if ((err as Error & { response?: { status: number } }).response?.status === 401) {
      clearViewpayTokenCache();
    }
    console.error("[ViewPay info] error:", err);
    const message = (err as Error).message || "결제 정보 조회에 실패했습니다.";
    return NextResponse.json(
      { success: false, message },
      { status: (err as Error & { response?: { status: number } }).response?.status ?? 500 }
    );
  }
}
