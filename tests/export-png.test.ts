import { describe, expect, it } from "vitest";
import { exportPosterPng } from "../client/src/export";
import type { Poster } from "../client/src/poster";

describe("exportPosterPng", () => {
  it("rejects when slots are incomplete", async () => {
    const poster: Poster = {
      gridSize: 9,
      title: "Test",
      background: "abyss",
      showCaptions: false,
      slots: [
        null, null, null, null, null, null, null, null, null
      ]
    };
    await expect(exportPosterPng(poster, "standard")).rejects.toThrow(
      "Fill every slot before creating a poster."
    );
  });
});
