import nodemailer from "nodemailer";

/**
 * 알림 기능 유틸리티
 * - 이메일 발송
 * - SMS 발송 (Solapi)
 */

// 이메일 발송 설정
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// 이메일 발송
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  try {
    if (!process.env.SMTP_USER) {
      console.warn("SMTP_USER is not configured. Email not sent.");
      return { success: false, message: "SMTP not configured" };
    }

    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "CallLink Shopping"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
}

// SMS 발송 (Solapi)
export async function sendSMS({
  to,
  message,
}: {
  to: string;
  message: string;
}) {
  try {
    if (!process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET) {
      console.warn("Solapi credentials not configured. SMS not sent.");
      return { success: false, message: "SMS service not configured" };
    }

    // Solapi REST API 호출
    const response = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SOLAPI_API_KEY}:${process.env.SOLAPI_API_SECRET}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        message: {
          to,
          from: process.env.SOLAPI_FROM_NUMBER || "02-0000-0000",
          text: message,
        },
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log("SMS sent:", result);
      return { success: true, result };
    } else {
      console.error("SMS send error:", result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, error };
  }
}

// 주문 생성 알림 발송
export async function sendOrderNotification({
  orderNo,
  clientName,
  totalAmount,
  partnerEmail,
  partnerPhone,
}: {
  orderNo: string;
  clientName: string;
  totalAmount: number;
  partnerEmail?: string;
  partnerPhone?: string;
}) {
  const formatPrice = (price: number) => new Intl.NumberFormat("ko-KR").format(price);

  // 이메일 발송
  if (partnerEmail) {
    await sendEmail({
      to: partnerEmail,
      subject: `[CallLink Shopping] 신규 주문 발생 - ${orderNo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #8B5CF6; border-bottom: 2px solid #8B5CF6; padding-bottom: 10px;">
            신규 주문이 접수되었습니다
          </h2>
          <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>주문번호:</strong> ${orderNo}</p>
            <p style="margin: 10px 0;"><strong>거래처:</strong> ${clientName}</p>
            <p style="margin: 10px 0;"><strong>주문금액:</strong> ${formatPrice(totalAmount)}원</p>
          </div>
          <p style="color: #666; font-size: 14px;">
            관리자 페이지에서 주문 상세 내역을 확인하실 수 있습니다.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #999; font-size: 12px;">
            <p>이 메일은 발신 전용입니다. 문의사항은 관리자 페이지를 이용해주세요.</p>
          </div>
        </div>
      `,
      text: `[CallLink Shopping] 신규 주문 발생
      
주문번호: ${orderNo}
거래처: ${clientName}
주문금액: ${formatPrice(totalAmount)}원

관리자 페이지에서 주문 상세 내역을 확인하실 수 있습니다.`,
    });
  }

  // SMS 발송
  if (partnerPhone) {
    await sendSMS({
      to: partnerPhone,
      message: `[CallLink Shopping] 신규 주문이 접수되었습니다.
주문번호: ${orderNo}
거래처: ${clientName}
금액: ${formatPrice(totalAmount)}원`,
    });
  }
}
