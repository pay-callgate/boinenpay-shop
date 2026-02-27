/**
 * T3.5: 사용자-거래처 매칭 유틸리티
 * - 자동 매칭 (링크 진입 시)
 * - 매칭 상태 확인
 * - 세션/쿠키 기반 client_source_id 관리
 */

// 클라이언트 소스 ID 쿠키 키
export const CLIENT_SOURCE_COOKIE = "client_source_id";
export const CLIENT_SOURCE_SLUG_COOKIE = "client_source_slug";

/**
 * 클라이언트 소스 ID를 쿠키에 저장 (브라우저 환경)
 */
export function setClientSourceCookie(clientId: string, clientSlug: string) {
  if (typeof document === "undefined") return;
  
  // 24시간 유효
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${CLIENT_SOURCE_COOKIE}=${clientId}; path=/; expires=${expires}; SameSite=Lax`;
  document.cookie = `${CLIENT_SOURCE_SLUG_COOKIE}=${clientSlug}; path=/; expires=${expires}; SameSite=Lax`;
}

/**
 * 클라이언트 소스 ID를 쿠키에서 가져오기 (브라우저 환경)
 */
export function getClientSourceCookie(): { clientId: string | null; clientSlug: string | null } {
  if (typeof document === "undefined") {
    return { clientId: null, clientSlug: null };
  }
  
  const cookies = document.cookie.split("; ");
  let clientId: string | null = null;
  let clientSlug: string | null = null;
  
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === CLIENT_SOURCE_COOKIE) {
      clientId = value;
    }
    if (name === CLIENT_SOURCE_SLUG_COOKIE) {
      clientSlug = value;
    }
  }
  
  return { clientId, clientSlug };
}

/**
 * 클라이언트 소스 쿠키 삭제
 */
export function clearClientSourceCookie() {
  if (typeof document === "undefined") return;
  
  document.cookie = `${CLIENT_SOURCE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  document.cookie = `${CLIENT_SOURCE_SLUG_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * 자동 매칭 수행 (로그인 후 호출)
 * @param clientSlug - 거래처 Slug
 * @param partnerId - 파트너 ID
 * @returns 매칭 결과
 */
export async function autoMatchUserClient(
  clientSlug: string,
  partnerId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch("/api/user-clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientSlug,
        partnerId,
        role: "member", // DB user_clients.role CHECK: 'member' | 'admin'
      }),
    });

    const data = await res.json();

    if (res.ok) {
      return { success: true, message: data.message };
    } else {
      return { success: false, error: data.error };
    }
  } catch {
    return { success: false, error: "네트워크 오류" };
  }
}

/**
 * 사용자의 거래처 매핑 확인
 * @param partnerId - 파트너 ID (선택)
 * @returns 매핑된 거래처 목록
 */
export async function getUserClients(partnerId?: string): Promise<{
  userClients: Array<{
    id: string;
    client_id: string;
    role: string;
    clients: {
      id: string;
      slug: string;
      name: string;
      logo_url: string | null;
      partner_id: string;
    } | null;
  }>;
  error?: string;
}> {
  try {
    const url = partnerId
      ? `/api/user-clients?partnerId=${partnerId}`
      : "/api/user-clients";

    const res = await fetch(url);
    const data = await res.json();

    if (res.ok) {
      return { userClients: data.userClients || [] };
    } else {
      return { userClients: [], error: data.error };
    }
  } catch {
    return { userClients: [], error: "네트워크 오류" };
  }
}

/**
 * 특정 거래처에 대한 매핑 확인
 * @param clientId - 거래처 ID
 * @returns 매핑 여부
 */
export async function checkUserClientMapping(clientId: string): Promise<boolean> {
  const { userClients } = await getUserClients();
  return userClients.some((uc) => uc.client_id === clientId);
}
