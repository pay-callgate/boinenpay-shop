const DAUM_SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

/** Daum 우편번호 스크립트를 동적으로 로드 */
export function loadDaumPostcodeScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("window undefined"));
  if (window.daum?.Postcode) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${DAUM_SCRIPT_URL}"]`);
    if (existing) {
      if (window.daum?.Postcode) return resolve();
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = DAUM_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Daum Postcode script load failed"));
    document.head.appendChild(script);
  });
}

/** 우편번호 검색 팝업 열기. 스크립트 로드 후 onComplete 호출 */
export function openDaumPostcode(onComplete: (data: { zonecode: string; address: string }) => void): void {
  loadDaumPostcodeScript()
    .then(() => {
      if (!window.daum?.Postcode) {
        alert("우편번호 서비스를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      new window.daum.Postcode({
        oncomplete(data: { zonecode: string; roadAddress: string; jibunAddress: string }) {
          const address = data.roadAddress || data.jibunAddress || "";
          onComplete({ zonecode: data.zonecode, address });
        },
      }).open();
    })
    .catch(() => {
      alert("우편번호 서비스를 불러올 수 없습니다. 주소를 직접 입력해 주세요.");
    });
}
