import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  uploadImage,
  generateFileName,
  getProductImagePath,
  getClientLogoPath,
  getClientLogoPendingPath,
  getBannerImagePath,
  BUCKETS,
  BucketName,
} from "@/lib/supabase/storage";

/**
 * T2-5: 이미지 업로드 API
 * POST /api/upload/image
 * FormData: file, bucket, partnerId, entityId (productId/clientId)
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = formData.get("bucket") as BucketName | null;
    const partnerId = formData.get("partnerId") as string | null;
    const entityId = formData.get("entityId") as string | null;

    // 필수 파라미터 검증
    if (!file) {
      return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    }
    if (!bucket || !Object.values(BUCKETS).includes(bucket)) {
      return NextResponse.json(
        { error: "유효한 버킷을 지정해주세요." },
        { status: 400 }
      );
    }
    if (!partnerId) {
      return NextResponse.json(
        { error: "partnerId가 필요합니다." },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "지원하지 않는 파일 형식입니다. (jpg, png, gif, webp만 허용)" },
        { status: 400 }
      );
    }

    // 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "파일 크기가 10MB를 초과합니다." },
        { status: 400 }
      );
    }

    // 파일명 생성 및 경로 결정
    const fileName = generateFileName(file.name);
    let path: string;

    switch (bucket) {
      case BUCKETS.PRODUCTS:
        if (!entityId) {
          return NextResponse.json(
            { error: "상품 이미지 업로드 시 entityId(productId)가 필요합니다." },
            { status: 400 }
          );
        }
        path = getProductImagePath(partnerId, entityId, fileName);
        break;
      case BUCKETS.CLIENTS:
        path = entityId
          ? getClientLogoPath(partnerId, entityId, fileName)
          : getClientLogoPendingPath(partnerId, fileName);
        break;
      case BUCKETS.BANNERS:
        path = getBannerImagePath(partnerId, fileName);
        break;
      default:
        return NextResponse.json(
          { error: "유효하지 않은 버킷입니다." },
          { status: 400 }
        );
    }

    // Buffer로 변환 후 업로드
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { url, error } = await uploadImage(bucket, path, buffer, file.type);

    if (error) {
      return NextResponse.json(
        { error: `업로드 실패: ${error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url,
      path,
      fileName,
    });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json(
      { error: "이미지 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
