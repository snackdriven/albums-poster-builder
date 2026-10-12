# Albums Poster Builder

Pick the 9, 12 or 15 albums that shaped you, arrange their covers, and download a
print-ready poster or vertical story. No account is needed to build a board.

**Hosting:** GitHub Pages at `https://albums.snackdriven.com`. Source, tests,
builds and releases live on GitHub. Deezer supplies album search and cover art;
Google Fonts supplies Inter. There is no Muse runtime, server or database.

## Development

Use Node.js 22.19 or newer:

```sh
npm ci
npm run dev
```

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

`npm run build` checks TypeScript and produces `dist/`. GitHub Actions runs the
board tests, desktop/mobile browser tests and production build on each push and
pull request. Successful builds of `main` deploy automatically to Pages.

## Hosting setup

1. Use a public repository on GitHub Free, or a private repository with a plan
   supporting Pages. A private source repository does not make the Pages site
   private.
2. In Settings → Pages, set the build source to **GitHub Actions**.
3. In Cloudflare DNS for `snackdriven.com`, add a **DNS only** CNAME:
   - Name: `albums`
   - Target: `snackdriven.github.io` (no repository path)
4. Set the Pages custom domain to `albums.snackdriven.com`. The build also ships
   `client/public/CNAME`. Enable Enforce HTTPS once GitHub provisions its certificate.

Default builds use `/` for the custom domain. To use the project URL without a
custom domain, remove `client/public/CNAME`, clear the Pages custom domain, and
set `PAGES_BASE_PATH=/albums-poster-builder/` for the build.

## Boards, privacy and migration

- The board is saved in this browser's local storage. It is not synced between
  devices. Use **Back up board** and **Restore board** to transfer JSON files.
- Share links carry a versioned copy of album details, positions, name, background
  and caption preference in the URL fragment. No `/s/{id}` server is needed.
  Anyone with the link can open it. Editing the received board saves a local copy.
- Uploaded covers are cropped and resized locally. They stay on the device and
  in JSON backups. Share links omit uploaded image bytes; recipients see their
  album details and a placeholder instead.
- Old Muse saved boards live in its database, not this Git export. This migration
  cannot automatically read that database. If a board was exported as JSON with
  `gridSize`, `title`, `background`, and `slots`, Restore board accepts that shape.
  Otherwise recreate it using search before retiring the old artifact.
- Browser storage failures are surfaced in the app; use a JSON backup if storage
  is blocked or full.

## Issue #1 coverage

Drag-and-drop and neighbor arrows; captions with a visibility switch; name/
@handle subtitle; full-board export gating; standard PNGs (1800×2100 for 9 albums,
1800×2700 for 12, 1800×3300 for 15) and 1080×1920 stories; portable share links,
Copy link and Post on X; duplicate prevention; manual albums and local cover
uploads; undo for removal/reset; action feedback; and nine named backgrounds.

The most-picked chart and global poster counter are intentionally omitted at the
owner's request. Standard posters grow vertically for 12/15 albums so cover art
and captions remain legible. Stories fit all three sizes into the same 9:16 frame.
