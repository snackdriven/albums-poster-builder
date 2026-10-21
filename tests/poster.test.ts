import { describe, expect, it } from "vitest";
import {
  normalizePoster,
  encodePoster,
  decodePoster,
  moveSlot,
  isDuplicate,
  posterDimensions,
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
    expect(() => encodePoster(largeBoard as any)).toThrow(
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
    expect(() => encodePoster(incompressibleBoard as any)).toThrow(
      "This board is too large for a share link. Use a JSON backup instead.",
    );
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
