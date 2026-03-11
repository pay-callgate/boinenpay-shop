import { redirect } from "next/navigation";

/**
 * 루트(/) 대문: 미들웨어를 통과해 오더라도 즉시 /admin으로 리다이렉트 (최후 방어선)
 */
export default function Home() {
  redirect("/admin");
}
