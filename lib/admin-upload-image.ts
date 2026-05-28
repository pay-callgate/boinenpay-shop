import { adminFetch } from "@/lib/admin-fetch";

export type AdminImageUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * 어드민 이미지 업로드 — API 오류 메시지를 그대로 표시하고, 401은 adminFetch에 위임.
 */
export async function postAdminImageUpload(
  formData: FormData
): Promise<AdminImageUploadResult> {
  try {
    const res = await adminFetch("/api/upload/image", {
      method: "POST",
      body: formData,
    });

    let data: { url?: string; error?: string } = {};
    try {
      data = (await res.json()) as { url?: string; error?: string };
    } catch {
      return {
        ok: false,
        error: `업로드 응답을 처리할 수 없습니다. (HTTP ${res.status})`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? `업로드에 실패했습니다. (HTTP ${res.status})`,
      };
    }

    if (data.url) {
      return { ok: true, url: data.url };
    }

    return { ok: false, error: data.error ?? "업로드에 실패했습니다." };
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_EXPIRED") {
      throw e;
    }
    return {
      ok: false,
      error: "로고 업로드 중 오류가 발생했습니다. 네트워크 연결을 확인해 주세요.",
    };
  }
}
