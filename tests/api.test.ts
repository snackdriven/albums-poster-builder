import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchAlbums } from "../client/src/api";

describe("searchAlbums", () => {
  let messageHandler: ((event: any) => void) | undefined;
  let mockContentWindow: any;

  beforeEach(() => {
    messageHandler = undefined;
    mockContentWindow = {};
    vi.useFakeTimers();

    // Mock global objects needed by searchAlbums
    vi.stubGlobal("window", {
      addEventListener: vi.fn().mockImplementation((event, handler) => {
        if (event === "message") messageHandler = handler;
      }),
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
            contentWindow: mockContentWindow,
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

  it("rejects with an error when payload type is 'error'", async () => {
    const searchPromise = searchAlbums("test query");

    expect(messageHandler).toBeDefined();
    messageHandler!({
      source: mockContentWindow,
      data: { type: "error" },
    });

    await expect(searchPromise).rejects.toThrow("Search failed. Check your connection or add the album manually.");
  });

  it("rejects with an error when payload is malformed", async () => {
    const searchPromise = searchAlbums("test query");

    expect(messageHandler).toBeDefined();
    messageHandler!({
      source: mockContentWindow,
      data: { invalid: "data" },
    });

    await expect(searchPromise).rejects.toThrow("Album search is unavailable. Try again or add it manually.");
  });
});
