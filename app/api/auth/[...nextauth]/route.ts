import NextAuth from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
