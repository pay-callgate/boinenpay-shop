import { describe, expect, it } from "vitest";
import { resolveUploadImageContentType } from "./upload-image-mime";

describe("resolveUploadImageContentType", () => {
  it("브라우저 MIME이 있으면 사용", () => {
    const file = new File([""], "a.png", { type: "image/png" });
    expect(resolveUploadImageContentType(file)).toBe("image/png");
  });

  it("MIME이 비어 있으면 확장자로 추론", () => {
    const file = new File([""], "logo.JPG", { type: "" });
    expect(resolveUploadImageContentType(file)).toBe("image/jpeg");
  });

  it("지원하지 않는 형식은 null", () => {
    const file = new File([""], "doc.pdf", { type: "application/pdf" });
    expect(resolveUploadImageContentType(file)).toBeNull();
  });
});
