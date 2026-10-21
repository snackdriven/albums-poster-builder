import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchAlbums } from "../client/src/api";

describe("searchAlbums", () => {
  let originalCrypto: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock global objects needed by searchAlbums
    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    originalCrypto = global.crypto;
    Object.defineProperty(global, 'crypto', {
      value: { randomUUID: () => "test-uuid" },
      writable: true,
      configurable: true
    });

    global.document = {
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
    } as any;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    Object.defineProperty(global, 'crypto', {
      value: originalCrypto,
      writable: true,
      configurable: true
    });
    // @ts-ignore
    delete global.window;
    // @ts-ignore
    delete global.document;
  });

  it("times out if no response is received within 12 seconds", async () => {
    const searchPromise = searchAlbums("test query");
    const catchPromise = expect(searchPromise).rejects.toThrow("Search timed out. Try again or add the album manually.");

    vi.advanceTimersByTime(12000);

    await catchPromise;
  });
});
