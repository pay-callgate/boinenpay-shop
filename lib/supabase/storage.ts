import { createServerSupabase } from "./server";

/**
 * T2-0: Supabase Storage 유틸리티
 * - 이미지 업로드/삭제
 * - Public URL 생성
 */

// Storage bucket 이름
export const BUCKETS = {
  PRODUCTS: "products",
  CLIENTS: "clients",
  BANNERS: "banners",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/**
 * 이미지 업로드
 * @param bucket - 버킷 이름
 * @param path - 저장 경로 (예: "partner-id/product-id/image.jpg")
 * @param file - 파일 Buffer 또는 Blob
 * @param contentType - MIME 타입
 */
export async function uploadImage(
  bucket: BucketName,
  path: string,
  file: Buffer | Blob,
  contentType: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = createServerSupabase();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("Storage upload error:", error);
    return { url: null, error: error.message };
  }

  // Public URL 생성
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return { url: publicUrl, error: null };
}

/**
 * 이미지 삭제
 * @param bucket - 버킷 이름
 * @param paths - 삭제할 파일 경로 배열
 */
export async function deleteImages(
  bucket: BucketName,
  paths: string[]
): Promise<{ success: boolean; error: string | null }> {
  if (paths.length === 0) {
    return { success: true, error: null };
  }

  const supabase = createServerSupabase();

  const { error } = await supabase.storage.from(bucket).remove(paths);

  if (error) {
    console.error("Storage delete error:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

/**
 * Public URL 가져오기
 * @param bucket - 버킷 이름
 * @param path - 파일 경로
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const supabase = createServerSupabase();
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
}

/**
 * 파일명 생성 유틸리티
 * @param originalName - 원본 파일명
 * @returns 고유 파일명 (timestamp + random + extension)
 */
export function generateFileName(originalName: string): string {
  const ext = originalName.split(".").pop()?.toLowerCase() || "jpg";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}.${ext}`;
}

/**
 * 상품 이미지 경로 생성
 * @param partnerId - 파트너 ID
 * @param productId - 상품 ID
 * @param fileName - 파일명
 */
export function getProductImagePath(
  partnerId: string,
  productId: string,
  fileName: string
): string {
  return `${partnerId}/${productId}/${fileName}`;
}

/**
 * 거래처 로고 경로 생성
 * @param partnerId - 파트너 ID
 * @param clientId - 거래처 ID (또는 'pending'으로 등록 전 업로드)
 * @param fileName - 파일명
 */
export function getClientLogoPath(
  partnerId: string,
  clientId: string,
  fileName: string
): string {
  return `${partnerId}/${clientId}/${fileName}`;
}

/**
 * 거래처 등록 전 로고 임시 업로드 경로 (entityId 없을 때)
 */
export function getClientLogoPendingPath(
  partnerId: string,
  fileName: string
): string {
  return `${partnerId}/pending/${fileName}`;
}

/**
 * 배너 이미지 경로 생성
 * @param partnerId - 파트너 ID
 * @param fileName - 파일명
 */
export function getBannerImagePath(partnerId: string, fileName: string): string {
  return `${partnerId}/${fileName}`;
}
