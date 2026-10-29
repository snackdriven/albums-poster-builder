import { afterEach, describe, expect, it, vi } from "vitest";
import { safeCover } from "../client/src/poster";

afterEach(() => vi.unstubAllGlobals());
const normalized = "https://cdn-images.dzcdn.net/cover.png";
const cases: [string, boolean, string][] = [
  ["ht\ntps://cdn-images.dzcdn.net/cover.png", false, normalized],
  ["ht\ttps://cdn-images.dzcdn.net/cover.png", false, normalized],
  ["htt\rps://cdn-images.dzcdn.net/cover.png", false, normalized],
  [" HTTPS://CDN-IMAGES.DZCDN.NET/cover.png ", false, normalized],
  ["https:cdn-images.dzcdn.net/cover.png", false, normalized],
  ["", false, ""],
  ["invalid URL", false, ""],
  ["http://cdn-images.dzcdn.net/cover.png", false, ""],
  ["javascript:alert(1)", false, ""],
  ["https://cdn-images.dzcdn.net.evil/cover.png", false, ""],
  ["https://user:pass@cdn-images.dzcdn.net/cover.png", false, ""],
  ["data:image/png;base64,AA==", false, ""],
  ["data:image/png;base64,AA==", true, "data:image/png;base64,AA=="],
  ["data:image/gif;base64,AA==", true, ""],
];

describe("safeCover URL parser compatibility", () => {
  it("fails closed when untyped callers supply values that cannot be coerced", () => {
    expect(safeCover(Symbol("cover") as unknown as string)).toBe("");
    expect(safeCover({ toString() { throw new Error("untrusted coercion"); } } as unknown as string)).toBe("");
  });
  it.each(cases)("preserves URL normalization and allowlist for %j (local %s)", (value, local, expected) => {
    expect(safeCover(value, local)).toBe(expected);
  });
  it("uses the same validation when URL.canParse is unavailable", () => {
    class LegacyURL extends URL {}
    Object.defineProperty(LegacyURL, "canParse", { value: undefined });
    vi.stubGlobal("URL", LegacyURL);
    for (const [value, local, expected] of cases) expect(safeCover(value, local)).toBe(expected);
  });
  it("avoids constructing invalid URLs when canParse is supported", () => {
    let constructions = 0;
    class CountingURL extends URL {
      constructor(value: string) { constructions++; super(value); }
    }
    vi.stubGlobal("URL", CountingURL);
    expect(safeCover("invalid URL")).toBe("");
    expect(constructions).toBe(0);
    expect(safeCover(normalized)).toBe(normalized);
    expect(constructions).toBe(1);
  });
});
