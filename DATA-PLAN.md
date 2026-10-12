# Data Plan

## Context provenance
- `no i mean buil.d our own ver` (verbatim build request; user wants our own version of my9albums.com, not a poster made on that site)
- `help me create this but 12 or 15` + `Build it with 15 albums` (prior user statements; grid sizes must go beyond the original's fixed 9 — ship 9, 12, and 15)
- `https://www.my9albums.com/` (user-supplied reference site; opened it: headline 'Pick the 9 albums that made you', tagline 'Search more than two million albums, put your nine in order, and share the poster', an empty 'Your collection — 0 of 9 albums' grid, 'Pick an empty slot to search for an album')
- Change of direction from the user via parent handoff: do NOT pre-load the user's 15 albums discussed earlier in the thread; the app opens with a completely empty grid exactly like the original, and the user fills every slot themselves via album search. No seeded or default picks anywhere.
- Kayla's standing prefs (USER CONTEXT): dark mode always, Catppuccin Mocha, Inter font, cool colors only; scannable layout, no walls of prose.

## Tested sources
### Deezer public API (album search + cover art)
**Used by**: `searchAlbums` server action (search), client grid + canvas poster export (cover images)
**Test command**: `curl -s 'https://api.deezer.com/search/album?q=Alexisonfire%20Crisis&limit=5'` and a Python sweep over 15 well-known album queries (Alexisonfire/Crisis, Movements/Feel Something, System of a Down/Toxicity, Deftones/White Pony, etc.)
**Sample output**: every query returned an exact-match album with `title`, `artist.name`, `id`, and `cover_big` (500px) / `cover_xl` (1000px) URLs on `cdn-images.dzcdn.net`. E.g. Crisis by Alexisonfire id=43043341; Toxicity by System Of A Down id=1434890. (These were capability probes only — none of this data is loaded into the app; the grid starts empty.)
**Processing**: server action fetches `https://api.deezer.com/search/album?q=<encoded>&limit=24`, maps results to {deezerId, title, artist, year (from release_date when present), coverMd (cover_big), coverLg (cover_xl)}, drops results with no cover, dedupes by id. No API key required.
**CORS check**: `curl -sI` on a `cdn-images.dzcdn.net` cover returned `Access-Control-Allow-Origin: *`, so the client can draw covers to a canvas with `crossOrigin='anonymous'` and export a PNG poster without tainting.

### iTunes Search API (rejected)
**Test command**: `curl -s 'https://itunes.apple.com/search?term=Alexisonfire%20Crisis&entity=album&limit=3'`
**Sample output**: `resultCount: 0` for Alexisonfire/Crisis; a plain 'Alexisonfire' album search surfaced only singles/EPs in the top results. Deezer found the exact album immediately.
**Processing**: not used.

## Long-term data behavior
- **Refresh policy**: none — no cron, no scheduled refresh. Search results are fetched live per query through the server action and not cached in the DB.
- **Growth**: one saved poster per user (single row, upserted): grid size (9/12/15), poster title, background choice, and the ordered slot list (album title/artist/year/cover URLs per slot, empty slots as null). Autosaves on every change so the poster survives reloads.
- **Ordering**: slots are strictly positional (rank order 1..N); reorder is by swapping two slots.
- **Time semantics**: no timestamps surfaced in the UI; `updated_at` is a plain creation/update instant.

## Rejected approaches
- **Tried**: iTunes Search API for album search/covers. **Why rejected**: missed real albums Deezer finds exactly (Alexisonfire — Crisis returned 0 results).
- **Tried**: pre-loading the 15 albums from the parent conversation as the starting poster. **Why rejected**: explicit change of direction from the user — the app must open with a completely empty grid like the original site; the user fills every slot themselves.
