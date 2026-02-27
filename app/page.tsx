/**
 * 루트 경로. 개발 시 middleware가 / → /yenmidang/ 로 리다이렉트하므로
 * 직접 노출되는 경우는 제한적 (예: API 등).
 */
export default function Home() {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-xl font-semibold">Call-Link Shopping Mall</h1>
      <p className="mt-2 text-gray-600">
        개발 환경에서는 <a href="/yenmidang/" className="text-blue-600 underline">/yenmidang/</a> 로 이동합니다.
      </p>
    </main>
  );
}

