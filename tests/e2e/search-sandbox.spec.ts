import { test, expect } from "@playwright/test";

test("search scripts cannot access the parent document or saved boards", async ({ page }) => {
  await page.route("https://api.deezer.com/**", (route) => {
    const callback = new URL(route.request().url()).searchParams.get("callback");
    return route.fulfill({
      contentType: "application/javascript",
      body: `
        let parentBlocked = false, storageBlocked = false;
        try { parent.document.body.dataset.compromised = "yes"; } catch { parentBlocked = true; }
        try { localStorage.getItem("albums-poster-v1"); } catch { storageBlocked = true; }
        ${callback}({ data: [{ id: 123, title: parentBlocked && storageBlocked ? "Isolated" : "Unsafe",
          artist: { name: "Sandbox" }, cover_big: "https://cdn-images.dzcdn.net/test.png" }] });
      `,
    });
  });
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { searchAlbums } = await import("/src/api.ts");
    return searchAlbums("test");
  });
  expect(result[0]?.title).toBe("Isolated");
  await expect(page.locator("body")).not.toHaveAttribute("data-compromised", "yes");
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("failed and cancelled searches remove their sandbox", async ({ page }) => {
  await page.route("https://api.deezer.com/**", (route) => route.abort());
  await page.goto("/");
  const failure = await page.evaluate(async () => {
    const { searchAlbums } = await import("/src/api.ts");
    try { await searchAlbums("offline"); } catch (error) { return (error as Error).message; }
  });
  expect(failure).toContain("Search failed");
  await expect(page.locator("iframe")).toHaveCount(0);
  const cancelled = await page.evaluate(async () => {
    const { searchAlbums } = await import("/src/api.ts");
    const controller = new AbortController();
    const search = searchAlbums("cancelled", controller.signal);
    controller.abort();
    try { await search; } catch (error) { return (error as Error).name; }
  });
  expect(cancelled).toBe("AbortError");
  await expect(page.locator("iframe")).toHaveCount(0);
});
