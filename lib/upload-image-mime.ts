const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export const UPLOAD_IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/**
 * 브라우저/OS에 따라 file.type 이 비어 있는 경우 확장자로 MIME 추론.
 */
export function resolveUploadImageContentType(file: File): string | null {
  const fromBrowser = file.type?.trim().toLowerCase();
  if (fromBrowser && UPLOAD_IMAGE_ALLOWED_TYPES.includes(fromBrowser as (typeof UPLOAD_IMAGE_ALLOWED_TYPES)[number])) {
    return fromBrowser;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const fromExt = EXT_TO_MIME[ext];
  if (fromExt) return fromExt;

  return null;
}
