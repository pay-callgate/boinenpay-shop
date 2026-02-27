import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import type { JWT } from "next-auth/jwt";

/**
 * NextAuth 설정 (Phase 0 T0-3, Phase 1 T1-1).
 * SNS OAuth: 구글, 카카오, 네이버.
 * 로그인 시 public.users upsert 시도 (Supabase). FK to auth.users 있으면 실패 가능 → docs/SUPABASE_SCHEMA_AUDIT 참고.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID ?? "",
      clientSecret: process.env.NAVER_CLIENT_SECRET ?? "",
    }),
  ],
  callbacks: {
    async signIn() {
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile && (profile as { email?: string }).email) {
        try {
          const { createServerSupabase } = await import("@/lib/supabase/server");
          const supabase = createServerSupabase();
          const email = (profile as { email?: string }).email ?? "";
          const name = (profile as { name?: string }).name ?? null;
          const provider = account.provider;
          const providerId = account.providerAccountId;

          // 🔥 Step 1: 이메일로 먼저 조회 (Find)
          const { data: existingUser, error: findError } = await supabase
            .from("users")
            .select("id, provider, provider_id")
            .eq("email", email)
            .maybeSingle();

          if (findError) {
            console.error("❌ [auth.ts] users 테이블 조회 실패:", findError);
            throw new Error("사용자 조회에 실패했습니다.");
          }

          let finalUserId: string | null = null;

          if (existingUser) {
            // 🔥 CASE A: 이미 존재하는 유저 → provider 정보 업데이트 후 UUID 가져오기
            console.log("✅ [auth.ts] 기존 유저 발견:", existingUser.id);
            
            // Provider 정보가 다를 수 있으니 업데이트 (같은 이메일, 다른 OAuth 계정으로 로그인 시)
            if (existingUser.provider !== provider || existingUser.provider_id !== providerId) {
              const { error: updateError } = await supabase
                .from("users")
                .update({
                  provider,
                  provider_id: providerId,
                  name,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingUser.id);

              if (updateError) {
                console.error("❌ [auth.ts] 유저 정보 업데이트 실패:", updateError);
              } else {
                console.log("✅ [auth.ts] Provider 정보 업데이트 완료");
              }
            }

            finalUserId = existingUser.id;
          } else {
            // 🔥 CASE B: 신규 유저 → Insert 후 UUID 가져오기
            console.log("🆕 [auth.ts] 신규 유저 생성 시도:", email);

            const { data: newUser, error: insertError } = await supabase
              .from("users")
              .insert({
                email,
                name,
                provider,
                provider_id: providerId,
                role: "end_customer",
              })
              .select("id")
              .single();

            if (insertError) {
              console.error("❌ [auth.ts] 신규 유저 생성 실패:", insertError);
              throw new Error("사용자 생성에 실패했습니다.");
            }

            if (!newUser || !newUser.id) {
              console.error("❌ [auth.ts] Insert 성공했으나 id가 반환되지 않음");
              throw new Error("사용자 ID를 가져올 수 없습니다.");
            }

            console.log("✅ [auth.ts] 신규 유저 생성 완료:", newUser.id);
            finalUserId = newUser.id;
          }

          // 🔥 최종 검증: UUID를 못 가져왔으면 로그인 차단
          if (!finalUserId) {
            console.error("❌ [auth.ts] 치명적 오류: UUID를 가져오지 못함");
            throw new Error("인증 처리 중 오류가 발생했습니다.");
          }

          // ✅ 토큰에 UUID 저장 (절대 Google ID가 들어가지 않음!)
          (token as JWT & { userId?: string }).userId = finalUserId;
          console.log("✅ [auth.ts] 토큰에 UUID 저장 완료:", finalUserId);

        } catch (err) {
          console.error("❌ [auth.ts] 치명적 오류:", err);
          // 🔥 에러 발생 시 로그인을 차단 (Google ID를 넣어서 통과시키지 않음!)
          throw err;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const userId = (token as JWT & { userId?: string }).userId;
        
        // 🔥 UUID가 없으면 세션 생성 실패
        if (!userId) {
          console.error("❌ [auth.ts] 세션에 userId가 없음. 로그인 차단!");
          throw new Error("인증 정보가 올바르지 않습니다.");
        }

        (session.user as { id?: string }).id = userId;
        console.log("✅ [auth.ts] 세션 생성 완료. userId:", userId);
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
