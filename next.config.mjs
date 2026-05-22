import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  /** 클라이언트에서 Vercel 배포 구분(실운영 vs 프리뷰) — VERCEL_ENV는 대시보드 자동 주입 */
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
  },
  reactStrictMode: true,
  devIndicators: false,
  /** Turbopack이 `app/`를 프로젝트 루트로 오인해 `next/package.json`을 못 찾는 경우 방지 */
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;

