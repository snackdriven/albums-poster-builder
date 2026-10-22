import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  emptyPoster,
  normalizePoster,
  encodePoster,
  decodePoster,
  moveSlot,
  isDuplicate,
  posterDimensions,
  safeCover,
  readPoster,
  STORAGE_KEY,
} from "../client/src/poster";
const album = {
  deezerId: 43043341,
  title: "Crisis",
  artist: "Alexisonfire",
  year: null,
  coverMd: "https://cdn-images.dzcdn.net/test.jpg",
  coverLg: "https://cdn-images.dzcdn.net/test.jpg",
};
const board = {
  gridSize: 9,
  title: "@Kayla 🎵",
  background: "slate",
  showCaptions: false,
  slots: [album, ...Array(8).fill(null)],
};

describe("emptyPoster", () => {
  it("returns a clean, default 3x3 board", () => {
    expect(emptyPoster()).toEqual({
      gridSize: 9,
      title: "",
      background: "abyss",
      showCaptions: true,
      slots: Array(9).fill(null),
    });
  });
});

describe("portable boards", () => {
  it("recovers an empty board from malformed saved data", () => {
    const result = normalizePoster({
      gridSize: 4,
      slots: ["broken"],
      background: "unknown",
    });
    expect(result?.gridSize).toBe(9);
    expect(result?.slots).toEqual(Array(9).fill(null));
    expect(result?.showCaptions).toBe(true);
  });
  it("preserves Unicode names, order, empty slots and captions in a share link", () => {
    expect(decodePoster(encodePoster(board))).toEqual(board);
  });
  it("rejects executable or arbitrary external cover URLs in shared data", () => {
    const result = normalizePoster({
      ...board,
      slots: [{ ...album, coverLg: "javascript:alert(1)" }],
    });
    expect(result?.slots[0]?.coverLg).toBe("");
  });
  it("keeps local uploaded covers out of public share payloads", () => {
    const local = {
      ...board,
      slots: [
        {
          ...album,
          deezerId: -1,
          coverMd: "data:image/png;base64,AA==",
          coverLg: "data:image/png;base64,AA==",
        },
        ...Array(8).fill(null),
      ],
    };
    const shared = decodePoster(encodePoster(local));
    expect(shared?.slots[0]?.title).toBe("Crisis");
    expect(shared?.slots[0]?.coverLg).toBe("");
  });
  it("rejects corrupt share payloads instead of replacing saved work", () => {
    expect(decodePoster("not-a-board")).toBeNull();
    expect(decodePoster(btoa("{}"))).toBeNull();
  });
  it("refuses to encode boards that exceed size limits", () => {
    const largeBoard = {
      ...board,
      gridSize: 15,
      slots: Array(15).fill({
        ...album,
        coverLg: "https://cdn-images.dzcdn.net/" + "A".repeat(5000),
      }),
    };
    expect(() => encodePoster(largeBoard)).toThrow(
      "This board is too large for a share link. Use a JSON backup instead.",
    );

    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    // Stable, varied input keeps the compressed-size check reproducible.
    let seed = 12345;
    const randomStr = (len: number) =>
      Array.from({ length: len }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return chars[Math.floor((seed / 0x100000000) * chars.length)];
      }).join("");
    const incompressibleBoard = {
      ...board,
      gridSize: 15,
      slots: Array.from({ length: 15 }, (_, i) => ({
        ...album,
        deezerId: i,
        title: randomStr(200),
        artist: randomStr(200),
        coverMd: "https://cdn-images.dzcdn.net/" + randomStr(800),
        coverLg: "https://cdn-images.dzcdn.net/" + randomStr(800),
      })),
    };
    expect(() => encodePoster(incompressibleBoard)).toThrow(
      "This board is too large for a share link. Use a JSON backup instead.",
    );
  });
  it("returns null when decoding fails due to invalid base64 or JSON", () => {
    // Pass something that fails atob or JSON.parse
    expect(decodePoster("z.invalid_base64!")).toBeNull();
  });
});
describe("positional board behavior", () => {
  it("moves by swapping with a neighbor, preserving gaps", () => {
    expect(moveSlot([album, null, { ...album, deezerId: 2 }], 0, 1)).toEqual([
      null,
      album,
      { ...album, deezerId: 2 },
    ]);
  });
  it("leaves a board unchanged at either boundary", () => {
    expect(moveSlot([album, null], 0, -1)).toEqual([album, null]);
    expect(moveSlot([album, null], 0, 2)).toEqual([album, null]);
  });
  it("prevents duplicates by ID or title and artist while allowing replacement", () => {
    expect(isDuplicate([album], album)).toBe(true);
    expect(
      isDuplicate([album], { ...album, deezerId: -1, title: " crisis " }),
    ).toBe(true);
    expect(isDuplicate([album], album, 0)).toBe(false);
  });
  it("exports portrait dimensions for every board size", () => {
    expect(posterDimensions(9, "standard")).toEqual([1800, 2100]);
    expect(posterDimensions(12, "standard")).toEqual([1800, 2700]);
    expect(posterDimensions(15, "standard")).toEqual([1800, 3300]);
    expect(posterDimensions(15, "story")).toEqual([1080, 1920]);
  });
});

it("round-trips a full board with long Unicode album metadata", () => {
  const longBoard = {
    ...board,
    gridSize: 15,
    slots: Array.from({ length: 15 }, (_, i) => ({
      ...album,
      deezerId: i + 1,
      title: "音".repeat(191),
      artist: "楽".repeat(190),
    })),
  };
  expect(decodePoster(encodePoster(longBoard))).toEqual(longBoard);
});

describe("safeCover validation", () => {
  it("allows valid HTTPS Deezer CDN URLs", () => {
    expect(safeCover("https://cdn-images.dzcdn.net/images/cover/123/500x500.jpg")).toBe("https://cdn-images.dzcdn.net/images/cover/123/500x500.jpg");
  });

  it("rejects non-HTTPS protocols", () => {
    expect(safeCover("http://cdn-images.dzcdn.net/images/cover/123/500x500.jpg")).toBe("");
    expect(safeCover("ftp://cdn-images.dzcdn.net/images/cover/123/500x500.jpg")).toBe("");
    expect(safeCover("javascript:alert(1)")).toBe("");
  });

  it("rejects non-Deezer hostnames", () => {
    expect(safeCover("https://example.com/image.jpg")).toBe("");
    expect(safeCover("https://cdn-images.other.net/image.jpg")).toBe("");
  });

  it("rejects URLs with credentials", () => {
    expect(safeCover("https://user:pass@cdn-images.dzcdn.net/image.jpg")).toBe("");
  });

  it("handles valid data URIs when local flag is true", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const jpeg = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const webp = "data:image/webp;base64,UklGRhoAAABXRUJQVlA=";

    expect(safeCover(png, true)).toBe(png);
    expect(safeCover(jpeg, true)).toBe(jpeg);
    expect(safeCover(webp, true)).toBe(webp);
  });

  it("rejects data URIs when local flag is false", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(safeCover(png, false)).toBe("");
    expect(safeCover(png)).toBe(""); // default is false
  });

  it("rejects unsupported data URIs and malformed strings", () => {
    const gif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    expect(safeCover(gif, true)).toBe("");

    // Invalid base64
    expect(safeCover("data:image/png;base64,not-base64!", true)).toBe("");

    // Not a valid URL
    expect(safeCover("just a string")).toBe("");
  });
});

describe("readPoster", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
    });
    vi.stubGlobal("location", {
      hash: "",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty poster when nothing is saved or shared", () => {
    const { poster, warning } = readPoster();
    expect(poster.gridSize).toBe(9);
    expect(warning).toBeNull();
  });

  it("reads a saved poster from localStorage", () => {
    mockStorage[STORAGE_KEY] = JSON.stringify({
      gridSize: 12,
      title: "Saved Board",
    });
    const { poster, warning } = readPoster();
    expect(poster.gridSize).toBe(12);
    expect(poster.title).toBe("Saved Board");
    expect(warning).toBeNull();
  });

  it("returns a warning if localStorage access throws an error", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Access denied");
      },
    });
    const { poster, warning } = readPoster();
    expect(poster.gridSize).toBe(9);
    expect(warning).toBe(
      "Saved board could not be read. Changes will stay here until you back them up.",
    );
  });

  it("reads a shared poster from location.hash and overrides saved data", () => {
    mockStorage[STORAGE_KEY] = JSON.stringify({
      gridSize: 12,
      title: "Saved Board",
    });
    const sharedBoard = encodePoster({
      ...board,
      title: "Shared Board",
      gridSize: 9,
    });
    vi.stubGlobal("location", { hash: `#poster=${sharedBoard}` });

    const { poster, warning } = readPoster();
    expect(poster.gridSize).toBe(9);
    expect(poster.title).toBe("Shared Board");
    expect(warning).toBeNull();
  });

  it("returns a warning and falls back to saved data if share link is invalid", () => {
    mockStorage[STORAGE_KEY] = JSON.stringify({
      gridSize: 12,
      title: "Saved Board",
    });
    vi.stubGlobal("location", { hash: `#poster=invalid-share-link` });

    const { poster, warning } = readPoster();
    expect(poster.gridSize).toBe(12);
    expect(poster.title).toBe("Saved Board");
    expect(warning).toBe(
      "This share link is invalid. Your saved board is still available.",
    );
  });
});
