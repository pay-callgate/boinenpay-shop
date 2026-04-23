import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { formatAdminNewrunSubmitLabel } from "@/lib/newrun/admin-order-newrun-summary";

/**
 * 개선-3: 주문 목록 엑셀 다운로드 API
 * GET /api/orders/export
 */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get("partnerId");
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const newrunSubmit = searchParams.get("newrunSubmit");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!partnerId) {
      return NextResponse.json({ error: "partnerId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data: admin } = await supabase
      .from("partner_admins")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("partner_id", partnerId)
      .maybeSingle();
    if (!admin) {
      return NextResponse.json({ error: "해당 파트너 주문 조회 권한이 없습니다." }, { status: 403 });
    }

    // 주문 조회 (전체, 페이지네이션 없음)
    let query = supabase
      .from("orders")
      .select(
        `
        id,
        order_no,
        status,
        total_amount,
        payment_method,
        payment_status,
        shipping_name,
        shipping_phone,
        shipping_address,
        shipping_detail,
        shipping_postcode,
        desired_delivery_date,
        delivery_time_slot,
        delivery_method,
        delivery_request_memo,
        ribbon_sender,
        ribbon_message,
        tracking_number,
        created_at,
        newrun_submit_status,
        newrun_rwr_result,
        newrun_rwr_orderkey,
        newrun_last_submit_at,
        client:clients (
          name
        ),
        user:users (
          name,
          email
        ),
        order_items (
          product_name,
          quantity,
          unit_price,
          total_price,
          option_json
        )
      `
      )
      .eq("partner_id", partnerId);

    // 필터 적용 (목록 API와 동일 AND)
    if (clientId) query = query.eq("client_id", clientId);
    if (status) query = query.eq("status", status);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (newrunSubmit && newrunSubmit !== "all") {
      switch (newrunSubmit) {
        case "not_sent":
          query = query.eq("payment_status", "paid").is("newrun_submit_status", null);
          break;
        case "ok":
          query = query.in("newrun_submit_status", ["success", "duplicate"]);
          break;
        case "failed":
          query = query.eq("newrun_submit_status", "failed");
          break;
        case "needs_attention":
          query = query.eq("newrun_submit_status", "skipped");
          break;
        default:
          break;
      }
    }
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    query = query.order("created_at", { ascending: false });

    const { data: orders, error } = await query;

    if (error) {
      console.error("Orders export fetch error:", error);
      return NextResponse.json({ error: "주문 조회 실패" }, { status: 500 });
    }

    // 엑셀 데이터 변환
    const excelData = orders?.map((order: any) => {
      const firstItem = order.order_items?.[0];
      const itemCount = order.order_items?.length || 0;
      const productName = firstItem
        ? `${firstItem.product_name}${itemCount > 1 ? ` 외 ${itemCount - 1}개` : ""}`
        : "";

      const desiredDate =
        order.desired_delivery_date != null && String(order.desired_delivery_date).trim() !== ""
          ? String(order.desired_delivery_date)
          : "";

      return {
        주문번호: order.order_no,
        주문일시: new Date(order.created_at).toLocaleString("ko-KR"),
        거래처: order.client?.name || "",
        주문자: order.user?.name || "",
        주문자이메일: order.user?.email || "",
        상품명: productName,
        주문금액: order.total_amount,
        결제수단: getPaymentMethodLabel(order.payment_method),
        결제상태: getPaymentStatusLabel(order.payment_status),
        주문상태: getOrderStatusLabel(order.status),
        뉴런발주: formatAdminNewrunSubmitLabel({
          payment_status: order.payment_status,
          newrun_submit_status: order.newrun_submit_status,
          newrun_rwr_result: order.newrun_rwr_result,
        }),
        협회주문번호: order.newrun_rwr_orderkey || "",
        희망배송일: desiredDate,
        배송시간대: order.delivery_time_slot || "",
        배송방식: order.delivery_method || "",
        배송요청메모: order.delivery_request_memo || "",
        리본보내는분: order.ribbon_sender || "",
        리본문구: order.ribbon_message || "",
        수령인: order.shipping_name,
        수령인전화번호: order.shipping_phone,
        우편번호: order.shipping_postcode || "",
        배송주소: order.shipping_address,
        배송주소상세: order.shipping_detail || "",
        송장번호: order.tracking_number || "",
      };
    }) || [];

    // 엑셀 워크북 생성
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "주문목록");

    // 컬럼 너비 설정
    worksheet["!cols"] = [
      { wch: 20 }, // 주문번호
      { wch: 20 }, // 주문일시
      { wch: 15 }, // 거래처
      { wch: 10 }, // 주문자
      { wch: 25 }, // 주문자이메일
      { wch: 30 }, // 상품명
      { wch: 12 }, // 주문금액
      { wch: 12 }, // 결제수단
      { wch: 12 }, // 결제상태
      { wch: 12 }, // 주문상태
      { wch: 14 }, // 뉴런발주
      { wch: 18 }, // 협회주문번호
      { wch: 12 }, // 희망배송일
      { wch: 14 }, // 배송시간대
      { wch: 10 }, // 배송방식
      { wch: 28 }, // 배송요청메모
      { wch: 12 }, // 리본보내는분
      { wch: 28 }, // 리본문구
      { wch: 10 }, // 수령인
      { wch: 15 }, // 수령인전화번호
      { wch: 10 }, // 우편번호
      { wch: 30 }, // 배송주소
      { wch: 20 }, // 배송주소상세
      { wch: 20 }, // 송장번호
    ];

    // 엑셀 파일을 Buffer로 변환
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // 파일명 생성 (예: orders_20240210.xlsx)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const filename = `orders_${today}.xlsx`;

    // 응답 헤더 설정
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err) {
    console.error("Orders export API error:", err);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// 헬퍼 함수
function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    card: "카드결제",
    bank_transfer: "계좌이체",
    virtual_account: "가상계좌",
    cash: "현금결제",
  };
  return labels[method] || method;
}

function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "결제대기",
    paid: "결제완료",
    completed: "결제완료",
    failed: "결제실패",
    refunded: "환불됨",
    cancelled: "결제취소",
  };
  return labels[status] || status;
}

function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    received: "접수",
    confirmed: "주문확정",
    pending_payment: "입금전",
    paid: "결제완료",
    preparing: "배송준비중",
    shipping: "배송중",
    delivered: "배송완료",
    cancelled: "취소",
  };
  return labels[status] || status;
}
