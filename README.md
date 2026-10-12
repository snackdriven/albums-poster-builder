# Albums Poster Builder

Build a poster of the albums that shaped you. Pick 9, 12, or 15 albums, arrange them in ranked order, and export a high-resolution poster.

Inspired by my9albums.com — with the grid sizes the original doesn't offer.

## Features

- **Three grid sizes** — 9 (3×3), 12, or 15 albums
- **Album search** — search millions of albums via the Deezer API, with real cover art
- **Ranked slots** — click an empty slot to fill it; click a filled slot to replace, swap, or remove it
- **Poster options** — optional poster title and four neutral backgrounds (Black, Charcoal, Slate, White)
- **Progress at a glance** — filled/total counter with a "Complete" state when the grid is full
- **Autosave** — your poster is saved as you work and restored on reload
- **PNG export** — download a high-resolution poster that matches what's on screen, footer included

## Tech stack

- React 19 + TypeScript
- Tailwind CSS 4
- TanStack Query
- Drizzle ORM (SQLite)
- Bun

## Project layout

```
client/   React front end
server/   Actions and data layer
drizzle/  Database schema and migrations
```

## Status and known limitations

This app was built on the Muse artifact runtime. Its storage and actions layer depends on `@hatch/space-sdk`, which is a local package from that runtime (see the `file:` dependency in `package.json`). As a result, the code does not yet run standalone outside that environment — replacing the SDK-backed storage layer is the main step toward making it independently deployable.

Behavior gaps relative to the original site (drag-and-drop reorder, shareable poster links, per-cover captions, and more) are tracked in [Issue #1](../../issues/1).

## Data

Album data and cover art are provided by [Deezer](https://www.deezer.com/).
