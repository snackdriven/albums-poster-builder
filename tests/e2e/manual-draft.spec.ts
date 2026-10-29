import { test, expect, type Page } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=",
  "base64",
);
async function openManual(page: Page) {
  await page.route("**/*", (route) =>
    route.request().url().startsWith("http://127.0.0.1:") ||
    route.request().url().startsWith("data:")
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Slot 1: empty/ }).click();
  await page
    .getByRole("button", { name: "Add it manually", exact: true })
    .click();
}

test("manual title, artist, uploaded cover and error survive a search-mode round trip", async ({
  page,
}) => {
  await openManual(page);
  await page.getByLabel("Album title", { exact: true }).fill("Draft album");
  await page.getByLabel("Artist", { exact: true }).fill(" ");
  await page
    .getByLabel("Cover image (optional)")
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  const preview = page.getByAltText("Uploaded cover preview");
  await expect(preview).toBeVisible();
  const cover = await preview.getAttribute("src");
  await page.getByRole("button", { name: "Add album", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Enter an album title and artist.",
  );
  await page.getByLabel("Artist", { exact: true }).fill("Draft artist");
  await page
    .getByRole("button", { name: "Back to search", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add it manually", exact: true })
    .click();
  await expect(page.getByLabel("Album title", { exact: true })).toHaveValue(
    "Draft album",
  );
  await expect(page.getByLabel("Artist", { exact: true })).toHaveValue(
    "Draft artist",
  );
  await expect(preview).toHaveAttribute("src", cover!);
  await expect(page.getByRole("alert")).toHaveText(
    "Enter an album title and artist.",
  );
  await page.getByRole("button", { name: "Add album", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Slot 1: Draft album by Draft artist",
      exact: true,
    }),
  ).toBeVisible();
});

test("an in-flight cover upload retains its owner while the manual view unmounts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src",
    )!;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(value: string) {
        if (value.startsWith("blob:")) {
          (window as unknown as { releaseCover: () => void }).releaseCover =
            () => descriptor.set!.call(this, value);
        } else descriptor.set!.call(this, value);
      },
    });
  });
  await openManual(page);
  await page.getByLabel("Album title", { exact: true }).fill("Pending cover");
  await page.getByLabel("Artist", { exact: true }).fill("Artist");
  await page
    .getByLabel("Cover image (optional)")
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("button", { name: "Reading cover…", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Back to search", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add it manually", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reading cover…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Album title", { exact: true })).toHaveValue(
    "Pending cover",
  );
  await page.evaluate(() =>
    (window as unknown as { releaseCover: () => void }).releaseCover(),
  );
  await expect(page.getByAltText("Uploaded cover preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add album", exact: true }),
  ).toBeEnabled();
});
