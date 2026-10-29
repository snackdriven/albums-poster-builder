import { describe, expect, it, vi, afterEach } from "vitest";
import { exportPosterPng } from "../client/src/export";
import type { Poster } from "../client/src/poster";

describe("exportPosterPng", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const validSlots = Array(9).fill({
    title: "A",
    artist: "B",
    coverMd: "a.jpg",
    coverLg: "a.jpg",
  });

  it("rejects when slots are incomplete", async () => {
    const poster: Poster = {
      gridSize: 9,
      title: "Test",
      background: "abyss",
      showCaptions: false,
      slots: [null, null, null, null, null, null, null, null, null],
    };
    await expect(exportPosterPng(poster, "standard")).rejects.toThrow(
      "Fill every slot before creating a poster.",
    );
  });

  it("exports a standard poster successfully", async () => {
    const mockCtx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn((cb) => cb(new Blob(["test"]))),
    };

    const mockLink = {
      href: "",
      download: "",
      rel: "",
      click: vi.fn(),
      remove: vi.fn(),
    };

    const mockDocument = {
      fonts: { ready: Promise.resolve() },
      createElement: vi.fn((tag) => {
        if (tag === "canvas") return mockCanvas;
        if (tag === "a") return mockLink;
        return {};
      }),
      body: {
        append: vi.fn(),
      },
    };
    vi.stubGlobal("document", mockDocument);

    const mockURL = {
      createObjectURL: vi.fn().mockReturnValue("blob:test"),
      revokeObjectURL: vi.fn(),
    };
    vi.stubGlobal("URL", mockURL);

    class MockBlob {
      constructor(public parts: unknown[]) {}
    }
    vi.stubGlobal("Blob", MockBlob);

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = "";
      _src = "";
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    vi.stubGlobal("Image", MockImage);

    const poster: Poster = {
      gridSize: 9,
      title: "Test",
      background: "abyss",
      showCaptions: true,
      slots: validSlots,
    };

    await exportPosterPng(poster, "standard");

    expect(mockDocument.createElement).toHaveBeenCalledWith("canvas");
    expect(mockCanvas.toBlob).toHaveBeenCalled();
    expect(mockURL.createObjectURL).toHaveBeenCalled();
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.download).toBe("albums-poster.png");
  });

  it("exports a story poster successfully", async () => {
    const mockCtx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn((cb) => cb(new Blob(["test"]))),
    };

    const mockLink = {
      href: "",
      download: "",
      rel: "",
      click: vi.fn(),
      remove: vi.fn(),
    };

    const mockDocument = {
      fonts: { ready: Promise.resolve() },
      createElement: vi.fn((tag) => {
        if (tag === "canvas") return mockCanvas;
        if (tag === "a") return mockLink;
        return {};
      }),
      body: {
        append: vi.fn(),
      },
    };
    vi.stubGlobal("document", mockDocument);

    const mockURL = {
      createObjectURL: vi.fn().mockReturnValue("blob:test"),
      revokeObjectURL: vi.fn(),
    };
    vi.stubGlobal("URL", mockURL);

    class MockBlob {
      constructor(public parts: unknown[]) {}
    }
    vi.stubGlobal("Blob", MockBlob);

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = "";
      _src = "";
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    vi.stubGlobal("Image", MockImage);

    const poster: Poster = {
      gridSize: 9,
      title: "Test",
      background: "abyss",
      showCaptions: true,
      slots: validSlots,
    };

    await exportPosterPng(poster, "story");

    expect(mockLink.download).toBe("albums-story.png");
  });

  it("fails if toBlob returns null", async () => {
    const mockCtx = {
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      save: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      restore: vi.fn(),
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      toBlob: vi.fn((cb) => cb(null)),
    };

    const mockDocument = {
      fonts: { ready: Promise.resolve() },
      createElement: vi.fn((tag) => {
        if (tag === "canvas") return mockCanvas;
        return {};
      }),
    };
    vi.stubGlobal("document", mockDocument);

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = "";
      _src = "";
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    vi.stubGlobal("Image", MockImage);

    const poster: Poster = {
      gridSize: 9,
      title: "Test",
      background: "abyss",
      showCaptions: true,
      slots: validSlots,
    };

    await expect(exportPosterPng(poster, "standard")).rejects.toThrow(
      "Could not render the poster image.",
    );
  });

  it("fails if canvas context is null", async () => {
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(null),
    };

    const mockDocument = {
      fonts: { ready: Promise.resolve() },
      createElement: vi.fn((tag) => {
        if (tag === "canvas") return mockCanvas;
        return {};
      }),
    };
    vi.stubGlobal("document", mockDocument);

    const poster: Poster = {
      gridSize: 9,
      title: "Test",
      background: "abyss",
      showCaptions: true,
      slots: validSlots,
    };

    await expect(exportPosterPng(poster, "standard")).rejects.toThrow(
      "Canvas is not available in this browser.",
    );
  });
});
