import { test, expect, type Page } from "@playwright/test";
const covers = Array.from({ length: 15 }, (_, i) => ({
  deezerId: i + 1,
  title: `Album ${i + 1}`,
  artist: `Artist ${i + 1}`,
  year: null,
  coverMd: `https://cdn-images.dzcdn.net/test-${i}.png`,
  coverLg: `https://cdn-images.dzcdn.net/test-${i}.png`,
}));
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=",
  "base64",
);
async function setup(page: Page, size = 9, filled = 2) {
  await page.route("https://cdn-images.dzcdn.net/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("https://api.deezer.com/**", (route) => {
    const callback = new URL(route.request().url()).searchParams.get(
      "callback",
    );
    return route.fulfill({
      contentType: "application/javascript",
      body: `${callback}(${JSON.stringify({ data: covers.map((a) => ({ id: a.deezerId, title: a.title, artist: { name: a.artist }, cover_big: a.coverMd, cover_xl: a.coverLg })) })});`,
    });
  });
  await page.addInitScript(
    ({ size, filled, covers }) => {
      if (!localStorage.getItem("albums-poster-v1"))
        localStorage.setItem(
          "albums-poster-v1",
          JSON.stringify({
            gridSize: size,
            title: "",
            background: "abyss",
            showCaptions: true,
            slots: Array.from({ length: size }, (_, i) =>
              i < filled ? covers[i] : null,
            ),
          }),
        );
    },
    { size, filled, covers },
  );
  await page.goto("/");
}
test("neighbor moves, removal and reset can be undone and survive reload", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Slot 1: Album 1 by Artist 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Move back", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Move forward", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Slot 2: Album 1 by Artist 1",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Slot 2: Album 1 by Artist 1",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Slot 2: Album 1 by Artist 1",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset board", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "2",
  );
});
test("search disables already picked results and manual albums work without a cover", async ({
  page,
}) => {
  await setup(page, 9, 1);
  await page.getByRole("button", { name: /Slot 2: empty/ }).click();
  await page.getByRole("searchbox").fill("Album");
  await expect(
    page.getByRole("button", { name: /Pick Album 1 by Artist 1/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Pick Album 2 by Artist 2/ }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "2",
  );
  await page.getByRole("button", { name: /Slot 3: empty/ }).click();
  await page
    .getByRole("button", { name: "Add it manually", exact: true })
    .click();
  await page
    .getByLabel("Album title", { exact: true })
    .fill("A missing record");
  await page.getByLabel("Artist", { exact: true }).fill("My artist");
  await page.getByRole("button", { name: "Add album", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Slot 3: A missing record by My artist",
      exact: true,
    }),
  ).toBeVisible();
});
test("complete boards export standard and story PNGs at exact dimensions", async ({
  page,
}) => {
  await setup(page, 9, 8);
  await expect(
    page.getByRole("button", { name: "Download poster (PNG)", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Slot 9: empty/ }).click();
  await page.getByRole("searchbox").fill("Album");
  await page.getByRole("button", { name: /Pick Album 9 by Artist 9/ }).click();
  await page.getByLabel("Name or @handle").fill("@Kayla");
  await expect(
    page.getByText("The sound that made @Kayla", { exact: true }),
  ).toBeVisible();
  for (const [button, width, height] of [
    ["Download poster (PNG)", 1800, 2100],
    ["Download story (PNG)", 1080, 1920],
  ] as const) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    const download = await downloading;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
  }
});
test("share links restore board options without a backend and edits persist", async ({
  page,
  context,
}) => {
  await setup(page, 15, 15);
  await page.getByLabel("Name or @handle").fill("Music 🎵");
  await page.getByLabel("Show album and artist").uncheck();
  await page
    .getByRole("button", { name: "Background: Lavender", exact: true })
    .click();
  await page.getByRole("button", { name: "Share board", exact: true }).click();
  const url = await page.getByLabel("Shareable board URL").inputValue();
  const recipient = await context.newPage();
  await recipient.goto(url);
  await expect(recipient.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "15",
  );
  await expect(recipient.getByLabel("Name or @handle")).toHaveValue("Music 🎵");
  await expect(recipient.getByLabel("Show album and artist")).not.toBeChecked();
  await recipient.getByLabel("Name or @handle").fill("Changed");
  await recipient.reload();
  await expect(recipient.getByLabel("Name or @handle")).toHaveValue("Changed");
});
test("dragging swaps covers on desktop", async ({ page }, info) => {
  test.skip(
    info.project.name === "mobile",
    "Touch reordering uses the move buttons",
  );
  await setup(page);
  await page
    .getByRole("button", { name: "Slot 1: Album 1 by Artist 1", exact: true })
    .dragTo(
      page.getByRole("button", {
        name: "Slot 2: Album 2 by Artist 2",
        exact: true,
      }),
    );
  await expect(
    page.getByRole("button", {
      name: "Slot 1: Album 2 by Artist 2",
      exact: true,
    }),
  ).toBeVisible();
});
test("uploaded covers remain local, JSON backup preserves them, and dialog keyboard focus is contained", async ({
  page,
}) => {
  await setup(page, 9, 0);
  await page.getByRole("button", { name: /Slot 1: empty/ }).click();
  await page
    .getByRole("button", { name: "Add it manually", exact: true })
    .click();
  await page.getByLabel("Album title", { exact: true }).fill("Local cover");
  await page.getByLabel("Artist", { exact: true }).fill("Local artist");
  await page
    .getByLabel("Cover image (optional)")
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Add album", exact: true }).click();
  await page.getByRole("button", { name: "Share board", exact: true }).click();
  await expect(page.getByLabel("Shareable board URL")).toBeVisible();
  const url = await page.getByLabel("Shareable board URL").inputValue();
  expect(url).not.toContain("data:");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Back up board", exact: true })
    .click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const backup = Buffer.concat(chunks);
  expect(JSON.parse(backup.toString()).slots[0].coverLg).toMatch(
    /^data:image\/(png|jpeg|webp);base64,/,
  );
  await page.getByRole("button", { name: "Reset board", exact: true }).click();
  await page
    .getByLabel("Restore board from JSON")
    .setInputFiles({
      name: "board.json",
      mimeType: "application/json",
      buffer: backup,
    });
  await expect(
    page.getByRole("button", {
      name: "Slot 1: Local cover by Local artist",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("button", {
        name: "Slot 1: Local cover by Local artist",
        exact: true,
      })
      .locator("img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBe(500);
});
