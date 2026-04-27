"use client";

import { useSession } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";

/**
 * 소셜/이메일 가입 후 추가 정보: 휴대폰 + 필수 약관.
 * /{subdomain}/signup/extra
 */
export default function SignupExtraPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) ?? "";
  const { data: session, status, update } = useSession();

  const callbackUrl = useMemo(() => {
    const raw = searchParams?.get("callbackUrl");
    const fallback = getStorefrontUrl(subdomain);
    if (raw == null || raw === "") return fallback;
    const safe = sanitizeCallbackUrlAgainstLoginLoop(raw);
    if (safe === "") return fallback;
    return safe;
  }, [searchParams, subdomain]);

  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated" && subdomain) {
      router.replace(`/${subdomain}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [status, subdomain, router, callbackUrl]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.profileCompleted) {
      router.replace(callbackUrl);
    }
  }, [status, session?.user?.profileCompleted, router, callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/profile/complete-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, termsAgreed: terms }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "저장에 실패했습니다.");
        return;
      }
      await update({ profileCompleted: true });
      router.replace(callbackUrl);
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white px-5 py-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-slate-900">회원 정보 입력</h1>
      <p className="mt-2 text-sm text-slate-600">
        서비스 이용을 위해 휴대폰 번호와 약관 동의가 필요합니다.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">이름</label>
          <input
            type="text"
            readOnly
            value={session?.user?.name ?? ""}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">이메일</label>
          <input
            type="email"
            readOnly
            value={session?.user?.email ?? ""}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">휴대폰 번호</label>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
            required
          />
        </div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            className="mt-1 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            <span className="font-semibold text-rose-600">(필수)</span> 이용약관 및 개인정보 처리방침에 동의합니다.
          </span>
        </label>

        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !terms}
          className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-semibold disabled:opacity-40"
        >
          {submitting ? "처리 중…" : "가입 완료"}
        </button>
      </form>
    </div>
  );
}
