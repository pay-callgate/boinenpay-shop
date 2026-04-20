import { NextRequest, NextResponse } from "next/server";

/**
 * 뉴런시스템(Newrun) 배송결과 리턴 URL — 서버 푸시 웹훅 (스텁)
 * 심사/접속 테스트 시 404 방지, 항상 200 + { success: true }
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  console.log("[Newrun:delivery-status] GET query:", url.search);
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const url = request.nextUrl;
  console.log("[Newrun:delivery-status] POST query:", url.search);

  let body: unknown;
  try {
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      body = await request.json();
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
    } else {
      const text = await request.text();
      body = text ? { raw: text } : {};
    }
  } catch {
    body = { parseError: true };
  }
  console.log("[Newrun:delivery-status] POST body:", body);

  return NextResponse.json({ success: true }, { status: 200 });
}
