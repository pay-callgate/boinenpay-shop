"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { useToast } from "@/components/shop/ToastContext";
import { ADMIN_ORDER_NOTIFY_POLL_MS } from "@/lib/admin-order-notify-poll";

/**
 * 사이드바·모바일 드로어 등 복수 UI가 동일 카운트를 쓰도록 단일 폴링 훅.
 */
export function useAdminOrderUnreadNotify(): number | null {
  const { toast } = useToast();
  const [unreadOrderNotify, setUnreadOrderNotify] = useState<number | null>(null);
  const partnerIdRef = useRef<string | null>(null);
  const lastUnreadPollRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function ensurePartner(): Promise<string | null> {
      if (partnerIdRef.current) return partnerIdRef.current;
      try {
        const res = await adminFetch("/api/partner");
        if (!res.ok) return null;
        const j = await res.json();
        const id = j.success && j.data?.id ? String(j.data.id) : null;
        if (id) partnerIdRef.current = id;
        return id;
      } catch {
        return null;
      }
    }
    async function poll() {
      const pid = await ensurePartner();
      if (!alive || !pid) return;
      try {
        const res = await adminFetch(
          `/api/partner/order-notifications?partnerId=${encodeURIComponent(pid)}`
        );
        if (!res.ok || !alive) return;
        const j = await res.json();
        const n = typeof j.unreadCount === "number" ? j.unreadCount : 0;
        const last = lastUnreadPollRef.current;
        if (last !== null && n > last) {
          const delta = n - last;
          window.setTimeout(() => {
            toast(`미확인 결제 완료 알림이 ${delta}건 늘었습니다.`, "default");
          }, 0);
        }
        lastUnreadPollRef.current = n;
        setUnreadOrderNotify(n);
      } catch {
        /* adminFetch가 401 시 리다이렉트 */
      }
    }
    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, ADMIN_ORDER_NOTIFY_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [toast]);

  return unreadOrderNotify;
}
