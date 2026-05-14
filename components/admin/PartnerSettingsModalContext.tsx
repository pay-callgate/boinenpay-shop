"use client";

import { createContext, useContext } from "react";

type PartnerSettingsModalContextValue = {
  openPartnerSettings: () => void;
};

export const PartnerSettingsModalContext =
  createContext<PartnerSettingsModalContextValue | null>(null);

export function usePartnerSettingsModal(): PartnerSettingsModalContextValue {
  const v = useContext(PartnerSettingsModalContext);
  if (v) return v;
  /** 온보딩 등 Provider 밖에서 헤더만 쓰는 경우 */
  return {
    openPartnerSettings: () => {
      alert(
        "파트너 설정은 기업 등록이 완료된 뒤 대시보드에서 이용할 수 있습니다."
      );
    },
  };
}
