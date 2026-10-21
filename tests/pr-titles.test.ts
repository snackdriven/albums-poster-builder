import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Execute the actual metadata-only workflow script against a mocked GitHub API.
const workflow = readFileSync(".github/workflows/release-conventions.yml", "utf8");
const script = workflow.split("          script: |\n")[1]!
  .split("  release-policy:")[0]!
  .split("\n").map((line) => line.slice(12)).join("\n");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const normalize = new AsyncFunction("github", "context", "core", script);
const attribution = "PR created automatically by Jules for task [123](https://jules.google.com/task/123)";

async function run(title: string, overrides: Record<string, unknown> = {}) {
  const edits: unknown[] = [];
  const pr = { number: 1, title, body: attribution, user: { login: "snackdriven" },
    head: { ref: "code-health/helpers", repo: { full_name: "snackdriven/albums-poster-builder" } }, ...overrides };
  const result = await normalize({ rest: { pulls: {
    get: async () => ({ data: pr }), update: async (edit: unknown) => { edits.push(edit); },
  } } }, { repo: { owner: "snackdriven", repo: "albums-poster-builder" }, issue: { number: 1 } }, { info: () => {} });
  return { result, edits };
}

describe("Jules PR title policy", () => {
  it.each([
    ["⚡ Optimize fitText using binary search", "perf: Optimize fitText using binary search"],
    ["⚡ [performance improvement] Replace redundant traversal", "perf: Replace redundant traversal"],
    ["🧹 [code health improvement] Refactor drawing helpers", "refactor: Refactor drawing helpers"],
    ["🧹 refactor: Extract decoding logic", "refactor: Extract decoding logic"],
    ["🧪 Add missing error test for size limits", "test: Add missing error test for size limits"],
    ["🔒 Fix XSS vulnerability in Deezer search", "fix: Fix XSS vulnerability in Deezer search"],
    ["🔒 Add noopener noreferrer to download links", "fix: Add noopener noreferrer to download links"],
  ])("repairs %s", async (original, expected) => {
    const { result, edits } = await run(original);
    expect(result).toBe(expected);
    expect(edits).toEqual([{ owner: "snackdriven", repo: "albums-poster-builder", pull_number: 1, title: expected }]);
  });
  it.each(["fix: preserve title", "feat(search)!: change API", "test(board): cover 🎵 Unicode"])("preserves valid title %s", async (title) => {
    expect(await run(title)).toEqual({ result: title, edits: [] });
  });
  it("does not edit other contributors' titles", async () => {
    expect(await run("Add a feature", { body: "Regular PR" })).toEqual({ result: "Add a feature", edits: [] });
  });
  it("does not edit forks even with Jules attribution", async () => {
    expect(await run("⚡ Optimize", { head: { ref: "jules-task", repo: { full_name: "someone/fork" } } }))
      .toEqual({ result: "⚡ Optimize", edits: [] });
  });
  it("recognizes a Jules branch without a body", async () => {
    expect((await run("⚡ Optimize", { body: null, head: { ref: "jules/task", repo: { full_name: "snackdriven/albums-poster-builder" } } })).result)
      .toBe("perf: Optimize");
  });
  it("treats title text as data", async () => {
    expect((await run('⚡ Optimize $(touch nope) "quoted"')).result).toBe('perf: Optimize $(touch nope) "quoted"');
  });
  it("rejects empty and multiline titles", async () => {
    await expect(run("⚡ ")).rejects.toThrow("Cannot normalize");
    await expect(run("⚡ Optimize\nother")).rejects.toThrow("Cannot normalize");
  });
});
