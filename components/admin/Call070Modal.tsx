"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/admin-fetch";

/**
 * T3-4: 070번호 연결 팝업 (TRD §7.2)
 * T3-5: CallCloud 자동 등록 연동
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
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function Call070Modal({
  clientId,
  clientName,
  serviceUrl,
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
  const [registering, setRegistering] = useState(false);
  const [config, setConfig] = useState<Call070Config | null>(null);

  // 기존 설정 로드
  useEffect(() => {
    if (!isOpen || !clientId) return;

    async function fetchConfig() {
      const res = await adminFetch(`/api/clients/${clientId}/070`);
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          setFormData({
            call_070_number: data.config.call_070_number || "",
            greeting_message: data.config.greeting_message || `안녕하세요 ${clientName}에 전화 주셔서 감사합니다.`,
            industry: data.config.industry || "화훼",
            admin_name: data.config.admin_name || "",
            admin_email: data.config.admin_email || "",
            admin_phone: data.config.admin_phone || "",
            sms_text_template: data.config.sms_text_template || `안녕하세요 ${clientName}입니다.`,
            callcloud_registered: data.config.callcloud_registered || false,
          });
        }
      }
    }
    fetchConfig();
  }, [isOpen, clientId, clientName]);

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

  // 070번호 연결: Payload를 register API로 전달 → 봇 성공 시에만 DB 저장 (Strict Consistency)
  const handleCallCloudRegister = async () => {
    if (!formData.call_070_number?.trim()) {
      alert("서비스 번호(070)는 필수입니다.");
      return;
    }

    if (
      !confirm(
        "CallCloud 백오피스 브라우저를 열어 등록을 진행합니다.\n계속하시겠습니까?"
      )
    ) {
      return;
    }

    setRegistering(true);

    try {
      const res = await adminFetch(`/api/clients/${clientId}/070/register`, {
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

      const data = await res.json();

      if (res.ok) {
        if (data.alreadyRegistered) {
          alert(data.message || "이미 CallCloud에 등록되어 있습니다.");
          onClose();
        } else {
          alert(data.message || "070번호 연동이 정상적으로 완료되었습니다.");
          setConfig((prev) => (prev ? { ...prev, callcloud_registered: true } : null));
          onSuccess();
          onClose();
        }
      } else {
        alert(
          `CallCloud 자동화 실행 실패:\n${data.error}\n\n상세: ${data.details || "없음"}`
        );
      }
    } catch (error) {
      console.error("CallCloud register error:", error);
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setRegistering(false);
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
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>070번호 연동</h2>
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

          <div style={{ marginTop: "24px", display: "flex", gap: "12px", justifyContent: "flex-end" }}>
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
            {!formData.callcloud_registered && (
              <button
                type="button"
                onClick={handleCallCloudRegister}
                disabled={registering}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4A90D9",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: registering ? "not-allowed" : "pointer",
                  fontWeight: 500,
                }}
              >
                {registering ? "연결 중..." : "070번호 연결"}
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
                ✓ 연결됨
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
