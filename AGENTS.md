# Albums Poster Builder

This is a standalone React and TypeScript app hosted on GitHub Pages. GitHub
Actions builds, tests and deploys it. No Muse/Hatch runtime or database is required.

Use Node.js 22.19 or newer and `npm ci`. Run `npm run dev` for development,
`npm run build` for production, `npm test` for board/share tests, and
`npm run test:e2e` for browser tests (install Chromium with
`npx playwright install chromium` first).

Keep 9/12/15 grids, positional gaps, browser-local autosave, local cover uploads,
and portable URL/JSON boards. Shared links must never include local uploaded
images. Test imports and shares as untrusted data. Never put GitHub or DNS
credentials into the browser bundle. Do not commit build output, local storage,
.env files, test receipts or node_modules.
