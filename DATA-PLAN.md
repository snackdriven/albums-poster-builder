# Data plan

Album search uses Deezer's public HTTPS JSONP endpoint from the browser. Queries
are limited to 120 characters, debounced, and have a 12-second timeout. No keys,
server proxy, cron jobs or database are involved. Errors offer retry or manual entry.
Only validated Deezer CDN cover URLs are loaded from imported or shared boards.

Boards start empty and offer 9, 12 or 15 strictly positional slots. Removal leaves
an empty slot; reordering swaps positions. Duplicate IDs and matching normalized
album/artist pairs cannot be added through search or manual entry.

The board persists in browser local storage under `albums-poster-v1`, including
name, background, caption preference and ordered album metadata. JSON backups
preserve local covers; URL-fragment shares omit them. Imported data is normalized
and constrained before rendering. The app never writes visitor boards into GitHub.

Cover uploads accept PNG/JPEG/WebP up to 10 MB, crop to a square, and resize to
500×500 JPEG locally. Album covers drawn for export use anonymous cross-origin
image loading. A broken remote cover blocks export with recovery instructions
instead of silently producing a poster with missing art.

The previous Muse database is not present in the repo and is not modified by this
migration. See README.md for backup/import options and deployment setup.
