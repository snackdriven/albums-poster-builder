import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchAlbums } from "../client/src/api";

describe("searchAlbums", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Mock global objects needed by searchAlbums
    vi.stubGlobal("window", {
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

  it("aborts immediately if the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const searchPromise = searchAlbums("test query", controller.signal);
    await expect(searchPromise).rejects.toThrow("Search cancelled");
  });

  it("aborts when the signal is triggered", async () => {
    const controller = new AbortController();

    const searchPromise = searchAlbums("test query", controller.signal);
    controller.abort();

    await expect(searchPromise).rejects.toThrow("Search cancelled");
  });
});
