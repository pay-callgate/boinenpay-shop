/**
 * 상품 대표 이미지 — 쇼핑몰 상세 히어로(3:4 고정 + object-cover)와 맞추기 위한 운영 안내
 */
export const PRODUCT_HERO_ASPECT_RATIO_LABEL = "3:4 (가로:세로)";

export const PRODUCT_IMAGE_UPLOAD_NOTICE = [
  `쇼핑몰 상품 상세 메인 영역은 ${PRODUCT_HERO_ASPECT_RATIO_LABEL} 비율로 표시됩니다.`,
  "권장 해상도: 1080 × 1440px 이상(동일 비율). 가로 1080px 미만이면 큰 화면에서 흐릿해질 수 있습니다.",
  "비율이 다르면 화면에서 상·하 또는 좌우가 잘려 보일 수 있으니, 업로드 전에 비율을 맞춰 주세요.",
  "형식: JPG, PNG, GIF, WebP · 최대 10MB",
].join("\n");
