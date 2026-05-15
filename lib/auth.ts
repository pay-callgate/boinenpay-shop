import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import type { JWT } from "next-auth/jwt";
import { logger } from "@/lib/logger";

type JwtExt = JWT & {
  userId?: string;
  profileCompleted?: boolean;
  role?: string;
};

/** 카카오: kakao_account.email / properties.nickname. 네이버: profile.response.name → nickname fallback (+ user.name). 기타: profile.name */
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
    const nick = props?.nickname?.trim();
    if (nick) return nick;
    const un = user?.name?.trim();
    return un || null;
  }
  if (provider === "naver") {
    const res = p?.response as { name?: string; nickname?: string } | undefined;
    const realName = res?.name?.trim();
    if (realName) return realName;
    const nickname = res?.nickname?.trim();
    if (nickname) return nickname;
    const un = user?.name?.trim();
    return un || null;
  }
  const top = (p?.name as string | undefined)?.trim();
  if (top) return top;
  const un = user?.name?.trim();
  return un || null;
}

async function loadUserFlags(userId: string): Promise<{
  profile_completed: boolean;
  role: string;
}> {
  const { createServerSupabase } = await import("@/lib/supabase/server");
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("profile_completed, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    return { profile_completed: false, role: "end_customer" };
  }
  return {
    profile_completed: !!data.profile_completed,
    role: String(data.role ?? "end_customer"),
  };
}

/**
 * redirect 콜백에서 절대 URL(https://ngrok…)에 baseUrl을 문자열로 붙이면
 * `http://localhost:3000https://…` 가 되어 INVALID_CALLBACK_URL_ERROR 가 난다.
 */
function collectAuthRedirectAllowedOrigins(baseUrl: string): Set<string> {
  const origins = new Set<string>();
  const add = (raw: string | undefined) => {
    const t = raw?.trim();
    if (!t) return;
    try {
      origins.add(new URL(t).origin);
    } catch {
      /* ignore */
    }
  };
  add(baseUrl);
  add(process.env.NEXTAUTH_URL);
  add(process.env.NEXT_PUBLIC_APP_URL);
  add(process.env.ALIMTALK_PUBLIC_ORIGIN);
  return origins;
}

function authRedirectCallback({ url, baseUrl }: { url: string; baseUrl: string }): string {
  if (url.startsWith("/")) {
    return `${baseUrl}${url}`;
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    logger.warn("auth_redirect_invalid_url", { data: { url: url.slice(0, 200), baseUrl } });
    return baseUrl;
  }
  const allowed = collectAuthRedirectAllowedOrigins(baseUrl);
  if (allowed.has(target.origin)) {
    return url;
  }
  logger.warn("auth_redirect_origin_rejected", {
    data: { origin: target.origin, baseUrl, urlPreview: url.slice(0, 120) },
  });
  return baseUrl;
}

/**
 * NextAuth: 카카오·네이버 OAuth + 이메일/비밀번호(Credentials).
 * 로그인 시 public.users upsert/조회 (Supabase Service Role).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "이메일(아이디)", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const emailRaw = credentials?.email?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";
        if (!emailRaw || !password) return null;
        const { createServerSupabase } = await import("@/lib/supabase/server");
        const { verifyMemberPassword } = await import("@/lib/member-password");
        const supabase = createServerSupabase();
        const { data: row, error } = await supabase
          .from("users")
          .select("id, email, name, password_hash")
          .eq("email", emailRaw)
          .maybeSingle();
        if (error || !row?.password_hash) return null;
        if (!verifyMemberPassword(password, row.password_hash)) return null;
        return {
          id: row.id,
          email: row.email,
          name: row.name ?? undefined,
        };
      },
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
    async jwt({ token, account, profile, user, trigger, session }): Promise<JWT> {
      const t = token as JwtExt;
      const existingUserId = t.userId;

      if (trigger === "update" && session && typeof session === "object") {
        const s = session as { profileCompleted?: boolean; role?: string };
        if (typeof s.profileCompleted === "boolean") {
          t.profileCompleted = s.profileCompleted;
        }
        if (typeof s.role === "string") {
          t.role = s.role;
        }
        return t;
      }

      if (account?.provider === "credentials" && user?.id) {
        const userId = String(user.id);
        t.userId = userId;
        const flags = await loadUserFlags(userId);
        t.profileCompleted = flags.profile_completed;
        t.role = flags.role;
        logger.info("auth_jwt_credentials", { userId, data: flags });
        return t;
      }

      const resolvedEmail = getEmailFromProfile(account?.provider, profile, user);
      console.log("[Auth] jwt callback", {
        hasAccount: !!account,
        provider: account?.provider,
        hasProfile: !!profile,
        resolvedEmail,
        existingUserId,
      });

      if (!account && existingUserId) {
        t.userId = existingUserId;
        const flags = await loadUserFlags(existingUserId);
        t.profileCompleted = flags.profile_completed;
        t.role = flags.role;
        return t;
      }

      if (account && (profile || user) && resolvedEmail) {
        try {
          const { createServerSupabase } = await import("@/lib/supabase/server");
          const supabase = createServerSupabase();
          const email = resolvedEmail;
          const name = getNameFromProfile(account.provider, profile, user);
          const provider = account.provider;
          const providerId = account.providerAccountId;

          const { data: existingUser, error: findError } = await supabase
            .from("users")
            .select("id, provider, provider_id, name")
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
            logger.info("auth_existing_user_found", {
              userEmail: email,
              userId: existingUser.id,
            });

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
            } else {
              const dbName = existingUser.name;
              const dbNameEmpty =
                dbName == null || String(dbName).trim() === "";
              const socialName =
                typeof name === "string" && name.trim() !== "" ? name.trim() : null;
              if (dbNameEmpty && socialName) {
                const { error: nameFillError } = await supabase
                  .from("users")
                  .update({
                    name: socialName,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", existingUser.id);

                if (nameFillError) {
                  logger.error("auth_user_name_fill_failed", {
                    userEmail: email,
                    userId: existingUser.id,
                    data: { error: nameFillError },
                  });
                } else {
                  logger.info("auth_user_name_filled", {
                    userEmail: email,
                    userId: existingUser.id,
                    data: { name: socialName },
                  });
                }
              }
            }

            finalUserId = existingUser.id;
          } else {
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
                profile_completed: false,
                terms_agreed: false,
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

            if (!newUser?.id) {
              logger.error("auth_new_user_create_missing_id", { userEmail: email });
              throw new Error("사용자 ID를 가져올 수 없습니다.");
            }

            logger.info("auth_new_user_created", {
              userEmail: email,
              userId: newUser.id,
            });
            finalUserId = newUser.id;
          }

          if (!finalUserId) {
            logger.error("auth_fatal_missing_user_id", { userEmail: email });
            throw new Error("인증 처리 중 오류가 발생했습니다.");
          }

          t.userId = finalUserId;
          const flags = await loadUserFlags(finalUserId);
          t.profileCompleted = flags.profile_completed;
          t.role = flags.role;
          logger.info("auth_token_user_id_set", {
            userEmail: email,
            userId: finalUserId,
            data: flags,
          });
        } catch (err) {
          logger.error("auth_jwt_callback_error", { data: { error: err } });
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

      return t;
    },
    async redirect({ url, baseUrl }) {
      console.log("[Auth] redirect callback", { url, baseUrl });
      return authRedirectCallback({ url, baseUrl });
    },
    async session({ session, token }) {
      const t = token as JwtExt;
      const userId = t.userId;
      console.log("[Auth] session callback", {
        hasUser: !!session?.user,
        userId,
        userEmail: session?.user?.email,
      });
      if (session.user) {
        if (!userId) {
          logger.error("auth_session_missing_user_id", {
            userEmail: session.user.email ?? undefined,
          });
          throw new Error("인증 정보가 올바르지 않습니다.");
        }

        session.user.id = userId;
        session.user.profileCompleted = t.profileCompleted === true;
        session.user.role = (t.role as string) ?? "end_customer";
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
    maxAge: 7200,
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
        userId: (token as JwtExt).userId,
      });
    },
  },
};
