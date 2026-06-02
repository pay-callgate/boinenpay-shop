"use client";

import { useEffect, useState } from "react";

let pendingOrderModalOpen = false;
const listeners = new Set<() => void>();

/** 진행 중인 주문 오버레이 열림 — 토스트 위치 조정용 */
export function setPendingOrderModalOpen(open: boolean): void {
  if (pendingOrderModalOpen === open) return;
  pendingOrderModalOpen = open;
  listeners.forEach((fn) => fn());
}

export function getPendingOrderModalOpen(): boolean {
  return pendingOrderModalOpen;
}

export function usePendingOrderModalOpen(): boolean {
  const [open, setOpen] = useState(pendingOrderModalOpen);
  useEffect(() => {
    const sync = () => setOpen(pendingOrderModalOpen);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return open;
}
