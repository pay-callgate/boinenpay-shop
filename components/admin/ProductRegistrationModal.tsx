"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminFetch } from "@/lib/admin-fetch";
import {
  DEFAULT_PRODUCT_DELIVERY_METHODS,
  normalizeDeliveryMethodsForDb,
} from "@/lib/product-delivery-methods";
import { PRODUCT_IMAGE_UPLOAD_NOTICE } from "@/lib/product-image-guidance";

/** 노출 순서: 당일배송 → 새벽배송 → 퀵서비스 → 택배 → 매장픽업 */
const deliveryOptions = [
  { id: "same_day", label: "당일배송" },
  { id: "dawn", label: "새벽배송" },
  { id: "quick", label: "퀵서비스" },
  { id: "parcel", label: "택배" },
  { id: "pickup", label: "매장픽업" },
] as const;

const formSchema = z.object({
  name: z.string().min(1, "상품명을 입력하세요"),
  categoryId: z.string().optional(),
  status: z.enum(["active", "draft", "sold_out"]).default("draft"),
  basePrice: z.coerce.number().min(0, "정상가는 0원 이상이어야 합니다.").default(0),
  salePrice: z.union([z.coerce.number().min(0, "비회원 판매가는 0원 이상이어야 합니다."), z.literal("")]),
  memberPrice: z.union([z.coerce.number().min(0, "회원 특별가는 0원 이상이어야 합니다."), z.literal("")]),
  stockQty: z.coerce.number().min(0, "재고는 0개 이상이어야 합니다.").default(0),
});

type FormValues = z.infer<typeof formSchema> & {
  thumbnailUrl?: string;
  categoryIds?: string[];
  deliveryMethods?: string[];
};

interface Category {
  id: string;
  name: string;
}

/** 수정 모드일 때 부모에서 넘겨주는 상품 데이터 (목록/상세 응답과 호환) */
export interface ProductInitialData {
  id: string;
  name: string;
  status: string;
  base_price: number;
  sale_price?: number | null;
  member_price?: number | null;
  stock_qty: number;
  thumbnail_url?: string | null;
  product_category_mappings?: { category_id: string }[];
  delivery_methods?: string[] | null;
}

interface ProductRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string | null;
  subdomain: string;
  /** 수정 시 기존 상품 데이터. 없으면 등록 모드 */
  initialData?: ProductInitialData | null;
  onSuccess?: () => void;
}

export function ProductRegistrationModal({
  open,
  onOpenChange,
  partnerId,
  subdomain,
  initialData = null,
  onSuccess,
}: ProductRegistrationModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(() => [
    ...DEFAULT_PRODUCT_DELIVERY_METHODS,
  ]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  /** 할인율(%) 표시용 — 정상가 대비, 양방향 동기화 */
  const [guestPctDraft, setGuestPctDraft] = useState("0");
  const [memberPctDraft, setMemberPctDraft] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as import("react-hook-form").Resolver<FormValues>,
    defaultValues: {
      name: "",
      status: "draft",
      basePrice: 0,
      salePrice: "",
      memberPrice: "",
      stockQty: 0,
    },
  });

  const basePrice = watch("basePrice");
  const salePrice = watch("salePrice");
  const memberPrice = watch("memberPrice");
  const salePriceNum = typeof salePrice === "number" ? salePrice : Number(salePrice) || 0;
  const memberPriceNum =
    typeof memberPrice === "number" ? memberPrice : Number(memberPrice) || 0;
  /** 회원 특별가 > 비회원 판매가 (유효성) */
  const memberHigherThanGuest =
    salePriceNum > 0 &&
    memberPriceNum > 0 &&
    memberPriceNum > salePriceNum;

  function pctFromBaseAndSale(base: number, sale: number): string {
    if (base <= 0) return "0";
    const pct = Math.round((1 - sale / base) * 100);
    return String(Math.min(100, Math.max(0, pct)));
  }

  useEffect(() => {
    if (!partnerId || !open) return;
    adminFetch(`/api/categories?partnerId=${partnerId}`)
      .then((res) => res.json())
      .then((data) => setCategories(data.flat || []));
  }, [partnerId, open]);

  // 등록/수정 모드에 따라 폼 초기화
  useEffect(() => {
    if (!open) return;
    if (initialData) {
      const categoryIdsFromMappings = initialData.product_category_mappings?.map((m) => m.category_id) ?? [];
      const firstCategoryId = categoryIdsFromMappings[0] ?? "";
      const bp = initialData.base_price;
      const sp = initialData.sale_price ?? bp;
      reset({
        name: initialData.name,
        status: initialData.status as FormValues["status"],
        basePrice: bp,
        salePrice: initialData.sale_price ?? bp,
        memberPrice: initialData.member_price ?? "",
        stockQty: initialData.stock_qty,
        categoryId: firstCategoryId,
      });
      setGuestPctDraft(pctFromBaseAndSale(bp, typeof sp === "number" ? sp : Number(sp) || 0));
      if (initialData.member_price != null && initialData.member_price > 0 && bp > 0) {
        setMemberPctDraft(pctFromBaseAndSale(bp, initialData.member_price));
      } else {
        setMemberPctDraft("");
      }
      setThumbnailUrl(initialData.thumbnail_url ?? "");
      setImagePreview(null);
      setCategoryIds(categoryIdsFromMappings);
      setDeliveryMethods(normalizeDeliveryMethodsForDb(initialData.delivery_methods));
    } else {
      reset({
        name: "",
        status: "draft",
        basePrice: 0,
        salePrice: "",
        memberPrice: "",
        stockQty: 0,
        categoryId: "",
      });
      setGuestPctDraft("0");
      setMemberPctDraft("");
      setThumbnailUrl("");
      setImagePreview(null);
      setCategoryIds([]);
      setDeliveryMethods([...DEFAULT_PRODUCT_DELIVERY_METHODS]);
    }
  }, [open, initialData, reset]);

  const onClose = useCallback(() => {
    reset();
    setGuestPctDraft("0");
    setMemberPctDraft("");
    setImagePreview(null);
    setThumbnailUrl("");
    setDeliveryMethods([...DEFAULT_PRODUCT_DELIVERY_METHODS]);
    setCategoryIds([]);
    onOpenChange(false);
  }, [onOpenChange, reset]);

  const regBase = register("basePrice", { valueAsNumber: true });
  const regSale = register("salePrice");
  const regMember = register("memberPrice");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partnerId) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("bucket", "products");
    fd.append("partnerId", partnerId);
    fd.append("entityId", "temp-" + Date.now());
    adminFetch("/api/upload/image", { method: "POST", body: fd })
      .then((res) => res.json())
      .then((data) => {
        if (data?.url) setThumbnailUrl(data.url);
      })
      .catch(() => {});
  };

  const onSubmit = async (data: FormValues) => {
    if (!partnerId) return;
    setSaving(true);
    try {
      const saleNum =
        typeof data.salePrice === "number" ? data.salePrice : Number(data.salePrice) || 0;
      const memberNum =
        typeof data.memberPrice === "number" ? data.memberPrice : Number(data.memberPrice) || 0;
      if (saleNum > 0 && memberNum > 0 && memberNum > saleNum) {
        alert("회원가가 비회원가보다 높습니다. 가격을 확인해 주세요.");
        setSaving(false);
        return;
      }
      const payload = {
        name: data.name,
        basePrice: data.basePrice,
        salePrice: saleNum || undefined,
        memberPrice: memberNum > 0 ? memberNum : undefined,
        stockQty: data.stockQty,
        status: data.status,
        thumbnailUrl: thumbnailUrl || undefined,
        deliveryMethods: normalizeDeliveryMethodsForDb(deliveryMethods),
        categoryIds: data.categoryId ? [data.categoryId] : categoryIds.length ? categoryIds : undefined,
      };

      const isEdit = !!initialData?.id;
      const url = isEdit ? `/api/products/${initialData!.id}` : "/api/products";
      const res = await adminFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? payload : { partnerId, ...payload }),
      });

      if (res.ok) {
        onSuccess?.();
        onClose();
      } else {
        const err = await res.json();
        alert(err.error || (isEdit ? "상품 수정에 실패했습니다." : "상품 등록에 실패했습니다."));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex max-h-[90vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{initialData ? "상품 수정" : "상품 등록"}</DialogTitle>
          <p className="mt-1 text-sm text-slate-300">
            {initialData ? "상품 정보를 수정한 뒤 저장하세요." : "새 상품 정보를 입력하세요."}
          </p>
          <DialogClose>✕</DialogClose>
        </DialogHeader>

        <DialogBody className="flex-1 min-h-0">
          <form id="product-reg-form" onSubmit={handleSubmit(onSubmit)} className="h-full">
            <div className="grid grid-cols-12 gap-6 p-6">
              {/* 좌측: 미디어 전용 - 갤러리 형태 (메인 크게, 추가 이미지 하단) */}
              <div className="col-span-5 flex flex-col gap-4">
                <p className="text-sm font-semibold text-slate-700">미디어</p>
                <p className="text-xs leading-relaxed text-slate-500 whitespace-pre-line">
                  {PRODUCT_IMAGE_UPLOAD_NOTICE}
                </p>
                {/* 메인 이미지: 쇼핑몰 상세와 동일 3:4 + cover 미리보기 */}
                <label className="flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 transition-colors hover:bg-slate-100/50">
                  {imagePreview || thumbnailUrl ? (
                    <img
                      src={imagePreview || thumbnailUrl}
                      alt="대표 이미지 미리보기"
                      className="h-full w-full object-cover object-center"
                    />
                  ) : (
                    <>
                      <svg className="mb-2 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                      </svg>
                      <span className="text-sm font-medium text-slate-500">대표 이미지</span>
                      <span className="mt-0.5 text-xs text-slate-400">클릭하여 업로드</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {/* 추가 이미지: 메인 바로 아래, 3열 그리드 */}
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex aspect-square items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400"
                    >
                      <span className="text-lg">+</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 우측: 입력 폼 (스크롤 영역) */}
              <div className="col-span-7 flex min-h-0 flex-col overflow-y-auto">
                <div className="space-y-5 pr-1">
            {/* B. 기본 정보 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">기본 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">상품명 *</label>
                    <input
                      {...register("name")}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-base focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                      placeholder="상품명을 입력하세요"
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">카테고리</label>
                    <select
                      {...register("categoryId")}
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                    >
                      <option value="">카테고리 선택</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">상태</label>
                    <select
                      {...register("status")}
                      className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                    >
                      <option value="draft">임시저장</option>
                      <option value="active">판매중</option>
                      <option value="sold_out">품절</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* C. 가격 및 재고 — Smart Pricing (정상가 대비 할인율 ↔ 판매가 양방향) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">가격 및 재고</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                    정상가 (소비자가)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    {...regBase}
                    onChange={(e) => {
                      regBase.onChange(e);
                      const v = parseFloat(e.target.value);
                      const next = Number.isFinite(v) ? v : 0;
                      setValue("salePrice", next, { shouldValidate: true, shouldDirty: true });
                      setGuestPctDraft("0");
                    }}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  />
                  {errors.basePrice && (
                    <p className="mt-1 text-xs text-red-600">{errors.basePrice.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {/* 비회원: 할인율 % + 판매가 원 */}
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                      비회원 판매가
                    </label>
                    <div className="flex w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={guestPctDraft}
                        disabled={basePrice <= 0}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.]/g, "");
                          setGuestPctDraft(raw);
                          if (raw === "" || raw === ".") return;
                          const pct = parseFloat(raw);
                          if (Number.isNaN(pct)) return;
                          const c = Math.min(100, Math.max(0, pct));
                          setValue(
                            "salePrice",
                            Math.round(basePrice * (1 - c / 100)),
                            { shouldValidate: true, shouldDirty: true }
                          );
                        }}
                        onBlur={() => {
                          if (basePrice <= 0) return;
                          if (guestPctDraft === "" || guestPctDraft === ".") {
                            setGuestPctDraft(pctFromBaseAndSale(basePrice, salePriceNum));
                            return;
                          }
                          const pct = parseFloat(guestPctDraft);
                          if (Number.isNaN(pct)) {
                            setGuestPctDraft(pctFromBaseAndSale(basePrice, salePriceNum));
                            return;
                          }
                          const c = Math.min(100, Math.max(0, pct));
                          setGuestPctDraft(String(c));
                          setValue(
                            "salePrice",
                            Math.round(basePrice * (1 - c / 100)),
                            { shouldValidate: true }
                          );
                        }}
                        className="w-[4.5rem] shrink-0 border-r border-slate-200 bg-slate-50 py-2.5 text-center text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="0"
                        aria-label="비회원 할인율 퍼센트"
                      />
                      <span
                        className="flex shrink-0 select-none items-center border-r border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500"
                        aria-hidden
                      >
                        %
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        disabled={basePrice <= 0}
                        {...regSale}
                        onChange={(e) => {
                          regSale.onChange(e);
                          const raw = e.target.value;
                          if (raw === "") return;
                          const num = parseFloat(raw);
                          if (!Number.isFinite(num) || basePrice <= 0) return;
                          setGuestPctDraft(pctFromBaseAndSale(basePrice, num));
                        }}
                        onBlur={(e) => {
                          regSale.onBlur(e);
                          if (basePrice > 0) {
                            const raw = e.target.value;
                            const num = raw === "" ? 0 : parseFloat(raw) || 0;
                            setGuestPctDraft(pctFromBaseAndSale(basePrice, num));
                          }
                        }}
                        className="min-w-0 flex-1 border-0 bg-white py-2.5 pl-3 pr-2 text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="비회원 판매가 원"
                      />
                      <span className="flex shrink-0 items-center border-l border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500">
                        원
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">정상가 대비 할인율 · 판매가 (연동)</p>
                    {errors.salePrice && (
                      <p className="mt-1 text-xs text-red-600">{String(errors.salePrice.message)}</p>
                    )}
                  </div>

                  {/* 회원: 할인율 % + 특별가 원 (비우면 비회원가와 동일 저장) */}
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                      회원 특별가
                    </label>
                    <div className="flex w-full min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={memberPctDraft}
                        disabled={basePrice <= 0}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.]/g, "");
                          setMemberPctDraft(raw);
                          if (raw === "") {
                            setValue("memberPrice", "", { shouldValidate: true, shouldDirty: true });
                            return;
                          }
                          const pct = parseFloat(raw);
                          if (Number.isNaN(pct)) return;
                          const c = Math.min(100, Math.max(0, pct));
                          setValue(
                            "memberPrice",
                            Math.round(basePrice * (1 - c / 100)),
                            { shouldValidate: true, shouldDirty: true }
                          );
                        }}
                        onBlur={() => {
                          if (memberPctDraft === "" || memberPctDraft === ".") {
                            setValue("memberPrice", "", { shouldValidate: true });
                            setMemberPctDraft("");
                            return;
                          }
                          const pct = parseFloat(memberPctDraft);
                          if (Number.isNaN(pct)) {
                            if (memberPriceNum > 0 && basePrice > 0) {
                              setMemberPctDraft(pctFromBaseAndSale(basePrice, memberPriceNum));
                            } else {
                              setMemberPctDraft("");
                              setValue("memberPrice", "");
                            }
                            return;
                          }
                          const c = Math.min(100, Math.max(0, pct));
                          setMemberPctDraft(String(c));
                          setValue(
                            "memberPrice",
                            Math.round(basePrice * (1 - c / 100)),
                            { shouldValidate: true }
                          );
                        }}
                        className="w-[4.5rem] shrink-0 border-r border-slate-200 bg-slate-50 py-2.5 text-center text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="—"
                        aria-label="회원 할인율 퍼센트"
                      />
                      <span
                        className="flex shrink-0 select-none items-center border-r border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-500"
                        aria-hidden
                      >
                        %
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="비우면 비회원가와 동일"
                        disabled={basePrice <= 0}
                        {...regMember}
                        onChange={(e) => {
                          regMember.onChange(e);
                          const raw = e.target.value;
                          if (raw === "") {
                            setMemberPctDraft("");
                            return;
                          }
                          const num = parseFloat(raw);
                          if (!Number.isFinite(num) || basePrice <= 0) return;
                          setMemberPctDraft(pctFromBaseAndSale(basePrice, num));
                        }}
                        onBlur={(e) => {
                          regMember.onBlur(e);
                          const raw = e.target.value;
                          if (raw === "") {
                            setMemberPctDraft("");
                            return;
                          }
                          if (basePrice > 0) {
                            const num = parseFloat(raw) || 0;
                            setMemberPctDraft(pctFromBaseAndSale(basePrice, num));
                          }
                        }}
                        className="min-w-0 flex-1 border-0 bg-white py-2.5 pl-3 pr-2 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="회원 특별가 원"
                      />
                      <span className="flex shrink-0 items-center border-l border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500">
                        원
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      비우면 저장 시 회원가는 비회원가와 동일(null)로 처리됩니다.
                    </p>
                    {errors.memberPrice && (
                      <p className="mt-1 text-xs text-red-600">{String(errors.memberPrice.message)}</p>
                    )}
                  </div>
                </div>

                {memberHigherThanGuest && (
                  <p className="text-sm font-medium text-red-600" role="alert">
                    회원가가 비회원가보다 높습니다.
                  </p>
                )}
                <div className="max-w-xs">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">재고 수량</label>
                  <input
                    type="number"
                    {...register("stockQty")}
                    min={0}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-600"
                  />
                </div>
              </CardContent>
            </Card>

            {/* D. 배송 및 옵션 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">배송 방법</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {deliveryOptions.map((opt) => (
                    <label key={opt.id} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={deliveryMethods.includes(opt.id)}
                        onChange={(e) => {
                          const id = opt.id as string;
                          if (e.target.checked) {
                            setDeliveryMethods((prev) =>
                              prev.includes(id) ? prev : [...prev, id]
                            );
                          } else {
                            setDeliveryMethods((prev) => prev.filter((x) => x !== id));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-slate-600"
                      />
                      <span className="text-sm text-slate-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
                </div>
              </div>
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="submit"
            form="product-reg-form"
            disabled={saving}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {initialData ? "수정 저장" : "상품 등록"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
