import { describe, expect, it } from "vitest";
import { readCover } from "../client/src/export";

describe("readCover validations", () => {
  it("rejects non-image file types", async () => {
    const file = new File(["content"], "document.pdf", { type: "application/pdf" });
    await expect(readCover(file)).rejects.toThrow("Choose a PNG, JPEG or WebP image.");
  });

  it("rejects unsupported image types", async () => {
    const file = new File(["content"], "image.gif", { type: "image/gif" });
    await expect(readCover(file)).rejects.toThrow("Choose a PNG, JPEG or WebP image.");
  });

  it("rejects files larger than 10MB", async () => {
    const file = new File(["content"], "large.png", { type: "image/png" });
    // Mock the size property since we don't want to actually allocate 10MB
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });
    await expect(readCover(file)).rejects.toThrow("Choose an image smaller than 10 MB.");
  });
});
