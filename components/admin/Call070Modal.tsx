"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * T3-4: 070번호 연결 팝업 (TRD §7.2)
 * 접수: 구글 시트 행 추가 + 슬랙 알림 → 담당자 CallCloud 수동 등록 → 시트 "완료" 시 웹훅으로 DB 동기화
 */

interface Call070Config {
  call_070_number: string;
  greeting_message: string;
  industry: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  sms_text_template: string;
  callcloud_registered?: boolean;
}

interface Props {
  clientId: string;
  clientName: string;
  serviceUrl: string;
  /** 거래처 담당자명 → 관리자명 자동 세팅 */
  contactName?: string;
  /** 거래처 담당자 연락처 → 관리자 전화번호 자동 세팅 */
  contactPhone?: string;
  /** 거래처 담당자 이메일 → 관리자 이메일 자동 세팅 */
  contactEmail?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function Call070Modal({
  clientId,
  clientName,
  serviceUrl,
  contactName = "",
  contactPhone = "",
  contactEmail = "",
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<Call070Config>({
    call_070_number: "",
    greeting_message: `안녕하세요 ${clientName}에 전화 주셔서 감사합니다.`,
    industry: "화훼",
    admin_name: "",
    admin_email: "",
    admin_phone: "",
    sms_text_template: `안녕하세요 ${clientName}입니다.`,
  });
  const [saving, setSaving] = useState(false);
  const [requestingQueue, setRequestingQueue] = useState(false);
  const [config, setConfig] = useState<Call070Config | null>(null);

  // 기존 설정 로드 + 담당자 정보로 관리자 필드 자동 세팅
  useEffect(() => {
    if (!isOpen || !clientId) return;

    async function fetchConfig() {
      const res = await adminFetch(`/api/clients/${clientId}/070`);
      if (res.ok) {
        const data = await res.json();
        const c = data.config;
        const defaultAdminName = c?.admin_name?.trim() || contactName || "";
        const defaultAdminEmail = c?.admin_email?.trim() || contactEmail || "";
        const defaultAdminPhone = c?.admin_phone?.trim() || contactPhone || "";
        if (c) {
          setConfig(c);
          setFormData({
            call_070_number: c.call_070_number || "",
            greeting_message: c.greeting_message || `안녕하세요 ${clientName}에 전화 주셔서 감사합니다.`,
            industry: c.industry || "화훼",
            admin_name: defaultAdminName,
            admin_email: defaultAdminEmail,
            admin_phone: defaultAdminPhone,
            sms_text_template: c.sms_text_template || `안녕하세요 ${clientName}입니다.`,
            callcloud_registered: c.callcloud_registered || false,
          });
        } else {
          setConfig(null);
          setFormData((prev) => ({
            ...prev,
            admin_name: defaultAdminName,
            admin_email: defaultAdminEmail,
            admin_phone: defaultAdminPhone,
          }));
        }
      }
    }
    fetchConfig();
  }, [isOpen, clientId, clientName, contactName, contactPhone, contactEmail]);

  // 저장
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.call_070_number.trim()) {
      alert("서비스 번호(070)는 필수입니다.");
      return;
    }

    setSaving(true);

    const res = await adminFetch(`/api/clients/${clientId}/070`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        call070Number: formData.call_070_number,
        greetingMessage: formData.greeting_message,
        industry: formData.industry,
        adminName: formData.admin_name,
        adminEmail: formData.admin_email,
        adminPhone: formData.admin_phone,
        smsTextTemplate: formData.sms_text_template,
      }),
    });

    setSaving(false);

    if (res.ok) {
      const data = await res.json();
      setConfig(data.config);
      alert("070번호 연결 정보가 저장되었습니다.");
      onSuccess();
      // 모달은 닫지 않고 070 연결 버튼을 표시
    } else {
      const data = await res.json();
      alert(data.error || "저장 실패");
    }
  };

 /** 시트 + 슬랙 접수 (CallCloud 자동화 없음) */
  const handleRequestQueue = async () => {
    if (!formData.call_070_number?.trim()) {
      alert("서비스 번호(070)는 필수입니다.");
      return;
    }

    if (
      !confirm(
        "070 연동 요청을 접수합니다.\n\n구글 시트에 행이 추가되고 슬랙으로 알림이 갑니다.\n콜게이트 담당자가 CallCloud에 등록한 뒤, 시트에서 진행 상태를 「완료」로 바꾸면 연동 완료로 반영됩니다.\n\n계속할까요?"
      )
    ) {
      return;
    }

    setRequestingQueue(true);

    try {
      const res = await adminFetch(`/api/clients/${clientId}/070/request-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call070Number: formData.call_070_number,
          greetingMessage: formData.greeting_message,
          industry: formData.industry,
          adminName: formData.admin_name,
          adminEmail: formData.admin_email,
          adminPhone: formData.admin_phone,
          smsTextTemplate: formData.sms_text_template,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        const rowMsg =
          typeof data.sheetRow === "number"
            ? `\n(시트 행: 약 ${data.sheetRow}번째 줄)`
            : "";
        alert((data.message as string) + rowMsg);
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                ...formData,
                callcloud_registered: false,
              }
            : { ...formData, callcloud_registered: false }
        );
        onSuccess();
        onClose();
        return;
      }

      alert(
        (data.error as string) ||
          `070 연동 요청 처리 실패 (HTTP ${res.status}). 다시 시도하거나 관리자에게 문의해 주세요.`
      );
    } catch (error) {
      console.error("070 request-queue error:", error);
      alert("요청 전송에 실패했습니다. 네트워크를 확인해 주세요.");
    } finally {
      setRequestingQueue(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #E5E7EB",
    borderRadius: "6px",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontWeight: 500,
    fontSize: "14px",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>070 번호 연동 (시트·슬랙 접수)</h2>
          <button
            onClick={onClose}
            style={{
              padding: "4px 8px",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: "20px",
              color: "#999",
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <p
            style={{
              fontSize: "13px",
              color: "#4B5563",
              lineHeight: 1.5,
              marginBottom: "16px",
              padding: "12px",
              background: "#F0F9FF",
              borderRadius: "8px",
              border: "1px solid #BAE6FD",
            }}
          >
            <strong>접수 절차:</strong> 아래 [070 연동 요청]을 누르면 설정이 저장되고, 구글 시트에 행이
            추가되며 슬랙으로 알림이 전송됩니다. 담당자가 CallCloud에 반영한 뒤 시트에서 진행 상태를
            「완료」로 변경하면 CallLink에 연동 완료로 표시됩니다.
          </p>
          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>
                고객사명 <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                value={clientName}
                readOnly
                style={{ ...inputStyle, backgroundColor: "#F9FAFB" }}
              />
            </div>

            <div>
              <label style={labelStyle}>
                서비스 번호 (070) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                value={formData.call_070_number}
                onChange={(e) =>
                  setFormData({ ...formData, call_070_number: e.target.value })
                }
                required
                placeholder="07012341234 (하이픈 없이)"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>인사말 멘트</label>
              <input
                type="text"
                value={formData.greeting_message}
                onChange={(e) =>
                  setFormData({ ...formData, greeting_message: e.target.value })
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>고객사 대표번호</label>
              <input
                type="text"
                value={formData.call_070_number}
                readOnly
                style={{ ...inputStyle, backgroundColor: "#F9FAFB" }}
              />
              <p style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                서비스 번호와 동일하게 적용됩니다.
              </p>
            </div>

            <div>
              <label style={labelStyle}>업종</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                style={inputStyle}
              >
                <option value="화훼">화훼</option>
                <option value="제조">제조</option>
                <option value="도소매">도소매</option>
                <option value="서비스">서비스</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>관리자명</label>
                <input
                  type="text"
                  value={formData.admin_name}
                  onChange={(e) => setFormData({ ...formData, admin_name: e.target.value })}
                  placeholder="홍길동"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>관리자 이메일</label>
                <input
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                  placeholder="hong@gmail.com"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>관리자 전화번호</label>
                <input
                  type="tel"
                  value={formData.admin_phone}
                  onChange={(e) => setFormData({ ...formData, admin_phone: e.target.value })}
                  placeholder="01012344321"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>
                서비스 URL <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                value={serviceUrl}
                readOnly
                style={{ ...inputStyle, backgroundColor: "#F9FAFB", fontFamily: "monospace" }}
              />
              <p style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                거래처 전용 URL이 자동으로 입력됩니다.
              </p>
            </div>

            <div>
              <label style={labelStyle}>SMS 텍스트</label>
              <textarea
                value={formData.sms_text_template}
                onChange={(e) =>
                  setFormData({ ...formData, sms_text_template: e.target.value })
                }
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </div>

          <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                backgroundColor: "#E5E7EB",
                color: "#333",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() =>
                void handleSubmit({ preventDefault: () => {} } as React.FormEvent)
              }
              disabled={saving || requestingQueue}
              style={{
                padding: "10px 20px",
                backgroundColor: "#F3F4F6",
                color: "#111827",
                border: "1px solid #D1D5DB",
                borderRadius: "6px",
                cursor: saving || requestingQueue ? "not-allowed" : "pointer",
                fontWeight: 500,
              }}
            >
              {saving ? "저장 중…" : "설정만 저장"}
            </button>
            {!formData.callcloud_registered && (
              <button
                type="button"
                onClick={() => void handleRequestQueue()}
                disabled={requestingQueue || saving}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4A90D9",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: requestingQueue || saving ? "not-allowed" : "pointer",
                  fontWeight: 500,
                }}
              >
                {requestingQueue ? "접수 중…" : "070 연동 요청"}
              </button>
            )}
            {formData.callcloud_registered && (
              <div
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#10B981",
                  color: "#fff",
                  borderRadius: "6px",
                  fontWeight: 500,
                }}
              >
                ✓ CallCloud 연동 완료
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
