import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchAlbums } from "../client/src/api";

describe("searchAlbums", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Mock global objects needed by searchAlbums
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });

    vi.stubGlobal("document", {
      createElement: vi.fn().mockImplementation((tag) => {
        if (tag === 'iframe') {
          return {
            setAttribute: vi.fn(),
            style: {},
            remove: vi.fn(),
          };
        }
        return {};
      }),
      head: { append: vi.fn() },
      body: { append: vi.fn() }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    vi.unstubAllGlobals();
  });

  it("times out if no response is received within 12 seconds", async () => {
    const searchPromise = searchAlbums("test query");
    const catchPromise = expect(searchPromise).rejects.toThrow("Search timed out. Try again or add the album manually.");

    vi.advanceTimersByTime(12000);

    await catchPromise;
  });
});
