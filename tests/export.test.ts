import { afterEach, describe, expect, it, vi } from "vitest";
import { readCover } from "../client/src/export";

describe("readCover validations", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("rejects non-image file types", async () => {
    const file = new File(["content"], "document.pdf", {
      type: "application/pdf",
    });
    await expect(readCover(file)).rejects.toThrow(
      "Choose a PNG, JPEG or WebP image.",
    );
  });

  it("rejects unsupported image types", async () => {
    const file = new File(["content"], "image.gif", { type: "image/gif" });
    await expect(readCover(file)).rejects.toThrow(
      "Choose a PNG, JPEG or WebP image.",
    );
  });

  it("rejects files larger than 10MB", async () => {
    const file = new File(["content"], "large.png", { type: "image/png" });
    // Mock the size property since we don't want to actually allocate 10MB
    Object.defineProperty(file, "size", { value: 10 * 1024 * 1024 + 1 });
    await expect(readCover(file)).rejects.toThrow(
      "Choose an image smaller than 10 MB.",
    );
  });

  it("successfully reads and crops a valid image", async () => {
    // 1. Mock URL methods
    const mockObjectURL = "blob:http://localhost/mock-uuid";
    const createObjectURLMock = vi.fn().mockReturnValue(mockObjectURL);
    const revokeObjectURLMock = vi.fn();
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    });

    // 2. Mock Image to simulate load
    class MockImage {
      naturalWidth = 800;
      naturalHeight = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = "";
      _src = "";

      set src(value: string) {
        this._src = value;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }

      get src() {
        return this._src;
      }
    }
    vi.stubGlobal("Image", MockImage);

    // 3. Mock Canvas & its Context
    const mockDrawImage = vi.fn();
    const mockToDataURL = vi
      .fn()
      .mockReturnValue("data:image/jpeg;base64,mockdata");
    const mockContext = {
      drawImage: mockDrawImage,
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
      toDataURL: mockToDataURL,
    };
    const mockCreateElement = vi.fn((tagName) => {
      if (tagName === "canvas") return mockCanvas as unknown as HTMLCanvasElement;
      return {};
    });
    vi.stubGlobal("document", {
      createElement: mockCreateElement,
    });

    try {
      const file = new File(["dummy content"], "cover.jpg", {
        type: "image/jpeg",
      });
      const result = await readCover(file);

      // Verify URL created
      expect(createObjectURLMock).toHaveBeenCalledWith(file);

      // Verify canvas size
      expect(mockCanvas.width).toBe(500);
      expect(mockCanvas.height).toBe(500);

      // Verify cropping logic:
      // min(800, 600) = 600
      // sx = (800 - 600) / 2 = 100
      // sy = (600 - 600) / 2 = 0
      // sw = 600, sh = 600
      // dx = 0, dy = 0, dw = 500, dh = 500
      expect(mockDrawImage).toHaveBeenCalledWith(
        expect.any(MockImage),
        100,
        0,
        600,
        600,
        0,
        0,
        500,
        500,
      );

      // Verify toDataURL params
      expect(mockToDataURL).toHaveBeenCalledWith("image/jpeg", 0.85);

      // Verify final return value
      expect(result).toBe("data:image/jpeg;base64,mockdata");
    } finally {
      // Verify cleanup
      expect(revokeObjectURLMock).toHaveBeenCalledWith(mockObjectURL);
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
