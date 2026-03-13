import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import type { JWT } from "next-auth/jwt";
import { logger } from "@/lib/logger";

/** 카카오는 profile.kakao_account.email / properties.nickname 에 값이 있음. 구글/네이버는 profile.email, profile.name */
function getEmailFromProfile(
  provider: string | undefined,
  profile: unknown,
  user: { email?: string | null } | undefined
): string | undefined {
  const p = profile as Record<string, unknown> | null | undefined;
  if (!p && !user?.email) return undefined;
  if (provider === "kakao") {
    const kakaoAccount = (p?.kakao_account as { email?: string } | undefined);
    return kakaoAccount?.email ?? user?.email ?? undefined;
  }
  return (p?.email as string | undefined) ?? user?.email ?? undefined;
}

function getNameFromProfile(
  provider: string,
  profile: unknown,
  user: { name?: string | null } | undefined
): string | null {
  const p = profile as Record<string, unknown> | null | undefined;
  if (provider === "kakao") {
    const props = (p?.properties as { nickname?: string } | undefined);
    return props?.nickname ?? user?.name ?? null;
  }
  return (p?.name as string | undefined) ?? user?.name ?? null;
}

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
    async signIn({ user, account, profile }) {
      const provider = account?.provider ?? "unknown";
      const profileEmail = getEmailFromProfile(account?.provider, profile, user);
      console.log("[Auth] signIn callback", {
        provider,
        profileEmail,
        profileKeys: profile ? Object.keys(profile as object) : [],
        userKeys: user ? Object.keys(user) : [],
      });
      logger.info("auth_sign_in_attempt", {
        userEmail: profileEmail ?? undefined,
        data: { provider },
      });
      return true;
    },
    async jwt({ token, account, profile, user }) {
      const existingUserId = (token as JWT & { userId?: string }).userId;
      const resolvedEmail = getEmailFromProfile(account?.provider, profile, user);
      console.log("[Auth] jwt callback", {
        hasAccount: !!account,
        provider: account?.provider,
        hasProfile: !!profile,
        resolvedEmail,
        existingUserId,
      });

      // 갱신 시(user/account 없음) 기존 토큰의 커스텀 데이터 보존 — JWT 콜백 버그 방어
      if (!account && existingUserId) {
        (token as JWT & { userId?: string }).userId = existingUserId;
        return token;
      }

      if (account && (profile || user) && resolvedEmail) {
        try {
          const { createServerSupabase } = await import("@/lib/supabase/server");
          const supabase = createServerSupabase();
          const email = resolvedEmail;
          const name = getNameFromProfile(account.provider, profile, user);
          const provider = account.provider;
          const providerId = account.providerAccountId;

          // 🔥 Step 1: 이메일로 먼저 조회 (Find)
          const { data: existingUser, error: findError } = await supabase
            .from("users")
            .select("id, provider, provider_id")
            .eq("email", email)
            .maybeSingle();

          if (findError) {
            logger.error("auth_users_find_failed", {
              userEmail: email,
              data: { error: findError },
            });
            throw new Error("사용자 조회에 실패했습니다.");
          }

          let finalUserId: string | null = null;

          if (existingUser) {
            // 🔥 CASE A: 이미 존재하는 유저 → provider 정보 업데이트 후 UUID 가져오기
            logger.info("auth_existing_user_found", {
              userEmail: email,
              userId: existingUser.id,
            });
            
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
                logger.error("auth_user_update_failed", {
                  userEmail: email,
                  userId: existingUser.id,
                  data: { error: updateError },
                });
              } else {
                logger.info("auth_user_provider_updated", {
                  userEmail: email,
                  userId: existingUser.id,
                  data: { provider, providerId },
                });
              }
            }

            finalUserId = existingUser.id;
          } else {
            // 🔥 CASE B: 신규 유저 → Insert 후 UUID 가져오기
            logger.info("auth_new_user_create_attempt", {
              userEmail: email,
              data: { provider, providerId },
            });

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
              logger.error("auth_new_user_create_failed", {
                userEmail: email,
                data: { error: insertError },
              });
              throw new Error("사용자 생성에 실패했습니다.");
            }

            if (!newUser || !newUser.id) {
              logger.error("auth_new_user_create_missing_id", {
                userEmail: email,
              });
              throw new Error("사용자 ID를 가져올 수 없습니다.");
            }

            logger.info("auth_new_user_created", {
              userEmail: email,
              userId: newUser.id,
            });
            finalUserId = newUser.id;
          }

          // 🔥 최종 검증: UUID를 못 가져왔으면 로그인 차단
          if (!finalUserId) {
            logger.error("auth_fatal_missing_user_id", {
              userEmail: email,
            });
            throw new Error("인증 처리 중 오류가 발생했습니다.");
          }

          // ✅ 토큰에 UUID 저장 (절대 Google ID가 들어가지 않음!)
          (token as JWT & { userId?: string }).userId = finalUserId;
          logger.info("auth_token_user_id_set", {
            userEmail: email,
            userId: finalUserId,
          });

        } catch (err) {
          logger.error("auth_jwt_callback_error", {
            data: { error: err },
          });
          // 🔥 에러 발생 시 로그인을 차단 (Google ID를 넣어서 통과시키지 않음!)
          throw err;
        }
      }

      if (!resolvedEmail && account) {
        console.warn("[Auth] jwt: no email in profile/user — login may redirect to signIn", {
          provider: account.provider,
          profileKeys: profile ? Object.keys(profile as object) : [],
          userKeys: user ? Object.keys(user ?? {}) : [],
        });
      }

      // 한 번 더 보존: 갱신 경로에서 token이 덮어씌워졌을 수 있음
      if (!account && existingUserId) {
        (token as JWT & { userId?: string }).userId = existingUserId;
      }
      return token;
    },
    async redirect({ url, baseUrl }) {
      console.log("[Auth] redirect callback", { url, baseUrl });
      return url.startsWith(baseUrl) ? url : baseUrl + url;
    },
    async session({ session, token }) {
      const userId = (token as JWT & { userId?: string }).userId;
      console.log("[Auth] session callback", {
        hasUser: !!session?.user,
        userId,
        userEmail: session?.user?.email,
      });
      if (session.user) {
        // 🔥 UUID가 없으면 세션 생성 실패
        if (!userId) {
          logger.error("auth_session_missing_user_id", {
            userEmail: session.user.email ?? undefined,
          });
          throw new Error("인증 정보가 올바르지 않습니다.");
        }

        (session.user as { id?: string }).id = userId;
        logger.info("auth_session_created", {
          userEmail: session.user.email ?? undefined,
          userId,
        });
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7200, // 2시간. 실질적 보안 관리는 AdminIdleGuard(유휴 30분)가 담당
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  logger: {
    error(code, metadata) {
      logger.error("auth_error", { data: { code, metadata } });
    },
  },
  events: {
    async signIn({ user, account }) {
      logger.info("auth_sign_in_success", {
        userEmail: user?.email ?? undefined,
        data: { userId: (user as { id?: string })?.id, provider: account?.provider },
      });
    },
    async signOut({ token }) {
      logger.info("auth_sign_out", {
        userEmail: token?.email ?? undefined,
        userId: (token as JWT & { userId?: string }).userId,
      });
    },
  },
};
