# Albums Poster Builder

**I've got too much personality to fit into nine choices.**

So there's room for twelve. Or fifteen. Pick the favorites that rewired your brain,
rearrange them until the order feels spiritually correct, and make a poster.

[Try the app](https://albums.snackdriven.com/) · [Report a bug](https://github.com/snackdriven/albums-poster-builder/issues)

## Features

- Search albums by title or artist, with real cover art.
- Arrange 9, 12, or 15 picks; customize backgrounds, captions, and a name subtitle.
- Export print-ready posters and 9:16 stories as PNGs.
- Share a board link or export a JSON backup.
- Add albums manually, upload your own cover art, and undo changes.

No account required. Built with React, TypeScript, and Vite; Deezer supplies search and artwork without an API key.

## Development

Requires Node.js 22.19+ and npm.

```sh
git clone https://github.com/snackdriven/albums-poster-builder.git
cd albums-poster-builder
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm test` | Board and share-link tests |
| `npm run test:e2e` | Desktop/mobile browser tests |
| `npm run build` | Type-check and build |
| `npm run preview` | Preview the build |

Run `npx playwright install chromium` before browser tests.

## Privacy

Your board saves in this browser and does not sync across devices. Use a JSON backup to move it elsewhere, including any uploaded cover art.

Anyone with a share link can view that board snapshot. Share links exclude uploaded images; those stay in your browser and JSON backups.

## Deployment

[GitHub Actions](.github/workflows/pages.yml) validates changes and deploys `main` to GitHub Pages. For your own deployment, select **GitHub Actions** in Pages settings and update [client/public/CNAME](client/public/CNAME) for your domain.

For a repository Pages URL, remove the CNAME file, clear the custom domain, and build with `PAGES_BASE_PATH=/albums-poster-builder/`.

Found a bug? Open an issue with the steps to reproduce it. For pull requests, include what changed and how you checked it.

## Commits and releases

See [RELEASE.md](RELEASE.md) for Commitizen commands, SemVer and changelog maintenance.
