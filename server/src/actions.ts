// Actions for the Albums Poster Builder.
//
// - searchAlbums: live album search against the Deezer public API (no key),
//   returning real cover art URLs. Results are never stored.
// - getPoster / savePoster: the user's one saved poster (grid size, title,
//   background, ordered slots). Starts completely empty; the user fills
//   every slot themselves via search.

import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const albumSchema = z.object({
  deezerId: z.number(),
  title: z.string(),
  artist: z.string(),
  year: z.number().nullable(),
  coverMd: z.string(),
  coverLg: z.string(),
});

type Album = z.infer<typeof albumSchema>;

const posterResponse = z.object({
  gridSize: z.number(),
  title: z.string(),
  background: z.string(),
  slots: z.array(albumSchema.nullable()),
});

type PosterState = z.infer<typeof posterResponse>;

const GRID_SIZES = [9, 12, 15] as const;

const BACKGROUND_IDS = ["abyss", "slate", "pine", "glacier"] as const;

const LEGACY_BACKGROUNDS: Record<string, string> = {
  mocha: "abyss",
  crust: "abyss",
  midnight: "slate",
  lavender: "glacier",
};

function normalizeBackground(value: string): string {
  if ((BACKGROUND_IDS as readonly string[]).includes(value)) return value;
  return LEGACY_BACKGROUNDS[value] ?? "abyss";
}

function emptyPoster(): PosterState {
  return {
    gridSize: 9,
    title: "",
    background: "abyss",
    slots: Array<Album | null>(9).fill(null),
  };
}

function normalizeSlots(
  slots: (Album | null)[],
  gridSize: number,
): (Album | null)[] {
  const out = slots.slice(0, gridSize);
  while (out.length < gridSize) out.push(null);
  return out;
}

interface DeezerAlbumRaw {
  id?: unknown;
  title?: unknown;
  cover_big?: unknown;
  cover_xl?: unknown;
  artist?: { name?: unknown } | null;
}

export const Actions = {
  searchAlbums: defineAction({
    request: z.object({
      query: z.string().trim().min(1).max(120),
    }),
    response: z.object({
      results: z.array(albumSchema),
    }),
    async handler(_ctx, args): Promise<{ results: Album[] }> {
      const url =
        "https://api.deezer.com/search/album?q=" +
        encodeURIComponent(args.query) +
        "&limit=24";
      let data: { data?: DeezerAlbumRaw[] };
      try {
        const res = await fetch(url, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) return { results: [] };
        data = (await res.json()) as { data?: DeezerAlbumRaw[] };
      } catch {
        return { results: [] };
      }
      const seen = new Set<number>();
      const results: Album[] = [];
      for (const raw of data.data ?? []) {
        const id = typeof raw.id === "number" ? raw.id : null;
        const title = typeof raw.title === "string" ? raw.title : null;
        const coverMd =
          typeof raw.cover_big === "string" ? raw.cover_big : null;
        const coverLg =
          typeof raw.cover_xl === "string" ? raw.cover_xl : coverMd;
        const artistName =
          raw.artist && typeof raw.artist.name === "string"
            ? raw.artist.name
            : null;
        if (id == null || !title || !coverMd || !coverLg || seen.has(id)) {
          continue;
        }
        seen.add(id);
        results.push({
          deezerId: id,
          title,
          artist: artistName ?? "",
          year: null,
          coverMd,
          coverLg,
        });
      }
      return { results };
    },
  }),

  getPoster: defineAction({
    request: z.object({}),
    response: posterResponse,
    async handler(ctx): Promise<PosterState> {
      const db = ctx.db<typeof schema>();
      const rows = await db
        .select()
        .from(schema.poster)
        .where(eq(schema.poster.id, 1))
        .limit(1);
      const row = rows[0];
      if (!row) return emptyPoster();
      const gridSize = (GRID_SIZES as readonly number[]).includes(row.gridSize)
        ? row.gridSize
        : 9;
      let slots: (Album | null)[] = [];
      try {
        const parsed: unknown = JSON.parse(row.slots);
        if (Array.isArray(parsed)) {
          slots = parsed.map((s) => {
            const p = albumSchema.safeParse(s);
            return p.success ? p.data : null;
          });
        }
      } catch {
        slots = [];
      }
      return {
        gridSize,
        title: row.title,
        background: normalizeBackground(row.background),
        slots: normalizeSlots(slots, gridSize),
      };
    },
  }),

  savePoster: defineAction({
    request: z.object({
      gridSize: z.number().int(),
      title: z.string().max(90),
      background: z.string().max(30),
      slots: z.array(albumSchema.nullable()).max(15),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const gridSize = (GRID_SIZES as readonly number[]).includes(args.gridSize)
        ? args.gridSize
        : 9;
      const background = normalizeBackground(args.background);
      const slots = normalizeSlots(args.slots, gridSize);
      const db = ctx.db<typeof schema>();
      const values = {
        id: 1,
        gridSize,
        title: args.title,
        background,
        slots: JSON.stringify(slots),
        updatedAt: new Date(),
      };
      await db
        .insert(schema.poster)
        .values(values)
        .onConflictDoUpdate({
          target: schema.poster.id,
          set: {
            gridSize: values.gridSize,
            title: values.title,
            background: values.background,
            slots: values.slots,
            updatedAt: values.updatedAt,
          },
        });
      ctx.invalidateQueries();
      return { ok: true };
    },
  }),
} satisfies ActionsModule;
