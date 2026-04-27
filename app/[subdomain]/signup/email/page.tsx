"use client";

import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getStorefrontUrl } from "@/lib/app-url";
import { sanitizeCallbackUrlAgainstLoginLoop } from "@/lib/shop-callback-url";

/**
 * 이메일(아이디) + 비밀번호 회원가입
 * /{subdomain}/signup/email
 */
export default function ShopEmailSignupPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subdomain = (params?.subdomain as string) ?? "";

  const callbackUrl = useMemo(() => {
    const raw = searchParams?.get("callbackUrl");
    const fallback = getStorefrontUrl(subdomain);
    if (raw == null || raw === "") return fallback;
    const safe = sanitizeCallbackUrlAgainstLoginLoop(raw);
    if (safe === "") return fallback;
    return safe;
  }, [searchParams, subdomain]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "가입에 실패했습니다.");
        return;
      }
      const sign = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("로그인에 실패했습니다. 로그인 페이지에서 시도해 주세요.");
        return;
      }
      router.replace(callbackUrl);
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white px-5 py-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-slate-900">이메일 회원가입</h1>
      <p className="mt-2 text-sm text-slate-600">이메일을 아이디로 사용합니다.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">이메일</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">비밀번호 (8자 이상)</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">이름 (선택)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
          />
        </div>
        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 text-white py-3.5 text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? "처리 중…" : "가입하기"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href={`/${subdomain}/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="underline">
          다른 방법으로 가입
        </Link>
      </p>
    </div>
  );
}
