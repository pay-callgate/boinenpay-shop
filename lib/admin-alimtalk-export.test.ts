import { describe, expect, it } from "vitest";
import { buildAlimtalkExcelRowWithIds } from "@/lib/admin-alimtalk-export";

describe("buildAlimtalkExcelRowWithIds", () => {
  it("접수 성공·카카오 실패를 구분해 기재", () => {
    const row = buildAlimtalkExcelRowWithIds(
      {
        id: "1",
        created_at: "2026-05-27T04:14:00.000Z",
        partner_id: "p",
        client_id: "c",
        phone_masked: "***-****-0000",
        callback_masked: null,
        provider_ok: true,
        delivery_status: "failed",
        result_code: "0",
        error_message: null,
        final_error_message: "카카오: 전화번호 오류",
        kakao_report_code: "33",
        kakao_report_message: "InvalidPhoneNumberException",
        sms_report_code: "999",
        sms_report_message: "유효하지 않은 수신번호",
        resolved_msg_preview: "test",
        batch_id: "batch-1",
        recipient_name: "테스트",
        cmid: "123",
        tran_id: "abc",
      },
      "기아자동차"
    );

    expect(row.접수결과코드).toBe("0");
    expect(row.접수코드설명).toBe("성공");
    expect(row.카카오전송코드).toBe("33");
    expect(String(row.카카오전송설명)).toContain("33");
    expect(row.LMS전환코드).toBe("999");
    expect(row.수신번호_마스킹).toBe("***-****-0000");
    expect(row.발송구분).toBe("대량발송");
  });
});
