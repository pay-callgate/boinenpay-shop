/** Daum(Kakao) 우편번호 API 전역 타입 */
declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          roadAddress: string;
          jibunAddress: string;
          address: string;
        }) => void;
      }) => { open: () => void };
    };
  }
}
export {};
