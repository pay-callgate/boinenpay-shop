"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { shopFetch } from "@/lib/shop-fetch";
import { toast } from "@/components/shop/ToastContext";

/** 주문서 디자인 시스템 - 더 연하고 부드러운 톤 */
const PRIMARY_SOFT = "#F3E8F5";
const PRIMARY_LINE = "#D6A8E0";
const CARD_RADIUS = "12px";

export interface Address {
  id: string;
  name: string;
  phone: string;
  postcode: string | null;
  address: string;
  detail: string | null;
  is_default: boolean;
}

interface AddressSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  addresses: Address[];
  selectedId: string | null;
  onSelect: (address: Address) => void;
  onAddNew?: () => void;
  onEdit?: (address: Address) => void;
  onDelete?: (address: Address) => void;
  /** 주문자 정보 - 신규 입력 시 자동 채움 */
  ordererName?: string;
  ordererPhone?: string;
}

/**
 * 배송지 선택 모달 - 원스톱 UX
 * list/form 뷰 전환, 모달 내부에서 신규 입력 폼 표시
 */
export function AddressSelectModal({
  isOpen,
  onClose,
  addresses,
  selectedId,
  onSelect,
  onAddNew,
  onEdit,
  onDelete,
  ordererName = "",
  ordererPhone = "",
}: AddressSelectModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"list" | "form">("list");
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPostcode, setFormPostcode] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formDetail, setFormDetail] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);

  const postcodeScriptLoaded = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setView("list");
      setFormName("");
      setFormPhone("");
      setFormPostcode("");
      setFormAddress("");
      setFormDetail("");
      setFormIsDefault(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view === "form") setView("list");
        else onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, view]);

  useEffect(() => {
    if (postcodeScriptLoaded.current || typeof window === "undefined") return;
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.head.appendChild(script);
    postcodeScriptLoaded.current = true;
  }, []);

  const handleOpenForm = () => {
    setFormName(ordererName || "");
    setFormPhone(ordererPhone || "");
    setView("form");
  };

  const openPostcodeSearch = () => {
    if (!window.daum?.Postcode) {
      toast("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete(data: { zonecode?: string; address?: string }) {
        setFormPostcode(data.zonecode || "");
        setFormAddress(data.address || "");
        setFormDetail("");
      },
    }).open();
  };

  const handleSaveAndSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim() || !formAddress.trim()) {
      toast("수령인, 연락처, 주소를 모두 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await shopFetch("/api/mypage/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          phone: formPhone.trim(),
          postcode: formPostcode || "",
          address: formAddress.trim(),
          detail: formDetail.trim() || undefined,
          isDefault: formIsDefault,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newAddr = data.address as Address;
        onSelect(newAddr);
        onClose();
      } else {
        const err = await res.json();
        toast(err.error || "배송지 저장에 실패했습니다.", "error");
      }
    } catch {
      toast("네트워크 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      {/* 4. 스크롤 없이 한 화면에 보이도록 max-w 및 overflow 설정 최적화 */}
      <div
        ref={modalRef}
        className="w-full max-w-[400px] overflow-hidden bg-white shadow-xl"
        style={{ borderRadius: CARD_RADIUS }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={view === "list" ? "배송지 목록" : "배송지 신규 입력"}
      >
        <div className="relative border-b border-gray-100 px-4 py-3 text-center">
          <h2 className="text-sm font-bold text-gray-800">배송지 목록</h2>
          <button
            type="button"
            onClick={() => (view === "form" ? setView("list") : onClose())}
            className="absolute right-4 top-3 text-gray-400"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-gray-50 p-3">
          {view === "list" ? (
            <div className="space-y-2">
              {/* 1. 세로 폭 3px 추가 축소 (py-2 -> py-1.5) */}
              <button
                type="button"
                onClick={handleOpenForm}
                className="flex w-full items-center justify-center gap-2 border py-1.5 text-xs font-medium transition-colors"
                style={{
                  borderColor: PRIMARY_LINE,
                  color: PRIMARY_LINE,
                  borderWidth: "1px",
                  borderRadius: CARD_RADIUS,
                }}
              >
                <Plus size={12} />
                배송지 신규 입력
              </button>

              <div className="max-h-[350px] space-y-2 overflow-y-auto pr-1">
                {addresses.length > 0 ? (
                  addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="relative border border-gray-100 bg-white p-3 shadow-sm"
                    style={{ borderRadius: CARD_RADIUS }}
                  >
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        {addr.name}
                      </span>
                      {addr.is_default && (
                        <span
                          className="px-1.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: PRIMARY_SOFT,
                            color: PRIMARY_LINE,
                            borderRadius: "4px",
                          }}
                        >
                          기본
                        </span>
                      )}
                    </div>
                    <div className="pr-16 text-xs leading-snug text-gray-600">
                      ({addr.postcode || ""}) {addr.address}{" "}
                      {addr.detail || ""}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {addr.phone}
                    </div>

                    {/* 선택 버튼: 더 작고 연하게 */}
                    <button
                      type="button"
                      onClick={() => onSelect(addr)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-bold transition-all"
                      style={{
                        backgroundColor:
                          selectedId === addr.id ? PRIMARY_LINE : PRIMARY_SOFT,
                        color:
                          selectedId === addr.id ? "#FFFFFF" : PRIMARY_LINE,
                        borderRadius: "6px",
                      }}
                    >
                      {selectedId === addr.id ? "선택됨" : "선택"}
                    </button>
                  </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500 leading-relaxed">
                    저장된 배송지가 없습니다.
                    <br />
                    위 버튼으로 새 배송지를 추가해주세요.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* 신규 입력 폼 */
            <form onSubmit={handleSaveAndSelect} className="space-y-2.5">
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="ml-1 text-xs font-bold text-gray-600">
                    수령인
                  </label>
                  <input
                    type="text"
                    placeholder="수령인 성함"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border border-gray-200 p-2 text-xs outline-none focus:border-[#D6A8E0]"
                    style={{ borderRadius: CARD_RADIUS }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="ml-1 text-xs font-bold text-gray-600">
                    연락처
                  </label>
                  <input
                    type="tel"
                    placeholder="휴대폰 번호"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full border border-gray-200 p-2 text-xs outline-none focus:border-[#D6A8E0]"
                    style={{ borderRadius: CARD_RADIUS }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="ml-1 text-xs font-bold text-gray-600">
                    주소
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="우편번호"
                      value={formPostcode}
                      readOnly
                      className="flex-1 border border-gray-200 bg-gray-50 p-2 text-xs outline-none"
                      style={{ borderRadius: CARD_RADIUS }}
                    />
                    {/* 3. 주소 검색 버튼: 한 줄 유지를 위해 px-2로 조정 및 텍스트 박스 높이 일치 */}
                    <button
                      type="button"
                      onClick={openPostcodeSearch}
                      className="min-w-[70px] whitespace-nowrap border px-2 text-[11px] font-medium transition-colors"
                      style={{
                        borderColor: PRIMARY_LINE,
                        color: PRIMARY_LINE,
                        borderWidth: "1px",
                        borderRadius: CARD_RADIUS,
                        backgroundColor: "white",
                      }}
                    >
                      주소 검색
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="기본 주소"
                    value={formAddress}
                    readOnly
                    className="mt-1 w-full border border-gray-200 bg-gray-50 p-2 text-xs outline-none"
                    style={{ borderRadius: CARD_RADIUS }}
                  />
                  <input
                    type="text"
                    placeholder="상세 주소"
                    value={formDetail}
                    onChange={(e) => setFormDetail(e.target.value)}
                    className="mt-1 w-full border border-gray-200 p-2 text-xs outline-none focus:border-[#D6A8E0]"
                    style={{ borderRadius: CARD_RADIUS }}
                  />
                </div>

                <label className="ml-1 flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#D6A8E0]"
                  />
                  <span className="text-xs text-gray-600">
                    이 주소를 기본 배송지로 저장
                  </span>
                </label>
              </div>

              {/* 4. 버튼 영역 간격 축소 및 동일 사이즈 */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="flex-1 border border-gray-200 bg-white py-2.5 text-xs font-medium text-gray-500"
                  style={{ borderRadius: CARD_RADIUS }}
                >
                  이전으로
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-xs font-bold text-white transition-opacity disabled:opacity-60"
                  style={{
                    backgroundColor: PRIMARY_LINE,
                    borderRadius: CARD_RADIUS,
                  }}
                >
                  {"저장 및 선택"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
