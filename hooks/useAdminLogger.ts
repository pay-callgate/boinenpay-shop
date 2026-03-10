import { useCallback } from "react";

interface AdminLogPayload {
  action: string;
  path?: string;
  data?: unknown;
}

export function useAdminLogger() {
  const trackAction = useCallback(async (action: string, data?: unknown) => {
    try {
      const payload: AdminLogPayload = {
        action,
        path: typeof window !== "undefined" ? window.location.pathname : undefined,
        data,
      };
      void fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // 로깅 실패는 UI에 영향을 주지 않음
      });
    } catch {
      // 무시: 로거 자체 실패는 사용자 흐름을 막지 않는다
    }
  }, []);

  return { trackAction };
}

