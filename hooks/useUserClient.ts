"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  getUserClients,
  autoMatchUserClient,
  setClientSourceCookie,
  getClientSourceCookie,
  clearClientSourceCookie,
} from "@/lib/user-client";
import type { UserClientRole } from "@/types/user-client";

interface Client {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  partner_id: string;
}

interface UserClient {
  id: string;
  client_id: string;
  role: UserClientRole;
  clients: Client | null;
}

interface UseUserClientResult {
  // 상태
  userClients: UserClient[];
  currentClient: Client | null;
  isMatched: boolean;
  loading: boolean;
  error: string | null;

  // 액션
  refresh: () => Promise<void>;
  autoMatch: (clientSlug: string, partnerId: string) => Promise<boolean>;
  setCurrentClient: (client: Client | null) => void;
  clearCurrentClient: () => void;
}

/**
 * T3.5: 사용자-거래처 매핑 훅
 * - 자동 매칭 지원
 * - 매칭 상태 관리
 * - 현재 선택된 거래처 관리
 */
export function useUserClient(partnerId?: string): UseUserClientResult {
  const { data: session, status } = useSession();
  const [userClients, setUserClients] = useState<UserClient[]>([]);
  const [currentClient, setCurrentClientState] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 사용자 거래처 목록 조회
  const refresh = useCallback(async () => {
    if (status !== "authenticated" || !session?.user) {
      setUserClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getUserClients(partnerId);
      if (result.error) {
        setError(result.error);
      } else {
        setUserClients(
          result.userClients.map((uc) => ({
            ...uc,
            role: uc.role as UserClientRole,
          }))
        );
      }
    } catch {
      setError("거래처 정보 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [session, status, partnerId]);

  // 초기 로드
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 쿠키에서 현재 거래처 복원
  useEffect(() => {
    if (userClients.length > 0 && !currentClient) {
      const { clientId } = getClientSourceCookie();
      if (clientId) {
        const matched = userClients.find((uc) => uc.client_id === clientId);
        if (matched?.clients) {
          setCurrentClientState(matched.clients);
        }
      }
    }
  }, [userClients, currentClient]);

  // 자동 매칭
  const autoMatch = useCallback(
    async (clientSlug: string, partnerIdForMatch: string): Promise<boolean> => {
      if (status !== "authenticated") return false;

      try {
        const result = await autoMatchUserClient(clientSlug, partnerIdForMatch);
        if (result.success) {
          await refresh();
          return true;
        } else {
          setError(result.error || "자동 매칭 실패");
          return false;
        }
      } catch {
        setError("자동 매칭 중 오류 발생");
        return false;
      }
    },
    [status, refresh]
  );

  // 현재 거래처 설정
  const setCurrentClient = useCallback((client: Client | null) => {
    setCurrentClientState(client);
    if (client) {
      setClientSourceCookie(client.id, client.slug);
    }
  }, []);

  // 현재 거래처 해제
  const clearCurrentClient = useCallback(() => {
    setCurrentClientState(null);
    clearClientSourceCookie();
  }, []);

  // 매칭 여부 (해당 파트너에 대해)
  const isMatched = userClients.length > 0;

  return {
    userClients,
    currentClient,
    isMatched,
    loading,
    error,
    refresh,
    autoMatch,
    setCurrentClient,
    clearCurrentClient,
  };
}
