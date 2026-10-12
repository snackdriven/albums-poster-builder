import { deflateSync, inflateSync } from "fflate";
import { z } from "zod";

export const GRID_SIZES = [9, 12, 15] as const;
export const BACKGROUNDS = [
  { id: "abyss", label: "Black", color: "#101013", light: false },
  { id: "slate", label: "Charcoal", color: "#23262b", light: false },
  { id: "pine", label: "Slate", color: "#334155", light: false },
  { id: "glacier", label: "White", color: "#f4f4f5", light: true },
  { id: "midnight", label: "Midnight", color: "#181825", light: false },
  { id: "navy", label: "Navy", color: "#172554", light: false },
  { id: "forest", label: "Pine", color: "#153c36", light: false },
  { id: "ice", label: "Ice", color: "#dbeafe", light: true },
  { id: "lavender", label: "Lavender", color: "#c4b5fd", light: true },
];
const albumSchema = z.object({
  deezerId: z.number().int(),
  title: z.string().trim().min(1).max(200),
  artist: z.string().max(200),
  year: z.number().int().nullable().default(null),
  coverMd: z.string().max(1000000).default(""),
  coverLg: z.string().max(1000000).default(""),
});
export type Album = z.infer<typeof albumSchema>;
export interface Poster {
  gridSize: number;
  title: string;
  background: string;
  showCaptions: boolean;
  slots: (Album | null)[];
}
export type Format = "standard" | "story";
export const STORAGE_KEY = "albums-poster-v1";
export function emptyPoster(): Poster {
  return {
    gridSize: 9,
    title: "",
    background: "abyss",
    showCaptions: true,
    slots: Array(9).fill(null),
  };
}
export function safeCover(value: string, local = false): string {
  if (
    local &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)
  )
    return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "cdn-images.dzcdn.net" &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function normalizePoster(value: unknown, local = false): Poster {
  if (!value || typeof value !== "object") return emptyPoster();
  const raw = value as Record<string, unknown>;
  const gridSize = GRID_SIZES.includes(raw.gridSize as 9 | 12 | 15)
    ? (raw.gridSize as number)
    : 9;
  const slots = Array.from({ length: gridSize }, (_, i) => {
    const parsed = albumSchema.safeParse(
      Array.isArray(raw.slots) ? raw.slots[i] : null,
    );
    return parsed.success
      ? {
          ...parsed.data,
          coverMd: safeCover(parsed.data.coverMd, local),
          coverLg: safeCover(parsed.data.coverLg, local),
        }
      : null;
  });
  const legacy: Record<string, string> = { mocha: "abyss", crust: "abyss" };
  const background =
    typeof raw.background === "string"
      ? (legacy[raw.background] ?? raw.background)
      : "abyss";
  return {
    gridSize,
    title: typeof raw.title === "string" ? raw.title.slice(0, 90) : "",
    background: BACKGROUNDS.some((b) => b.id === background)
      ? background
      : "abyss",
    showCaptions: raw.showCaptions !== false,
    slots,
  };
}
export function encodePoster(poster: Poster): string {
  const clean = normalizePoster(poster);
  const payload = {
    v: 1,
    g: clean.gridSize,
    n: clean.title,
    b: clean.background,
    c: clean.showCaptions,
    a: clean.slots.map((a) =>
      a ? [a.deezerId, a.title, a.artist, a.year, a.coverLg, a.coverMd] : null,
    ),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.length > 65536)
    throw new Error(
      "This board is too large for a share link. Use a JSON backup instead.",
    );
  const encoded =
    "z." +
    btoa(String.fromCharCode(...deflateSync(bytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  if (encoded.length > 16000)
    throw new Error(
      "This board is too large for a share link. Use a JSON backup instead.",
    );
  return encoded;
}

export function decodePoster(encoded: string): Poster | null {
  if (!encoded || encoded.length > (encoded.startsWith("z.") ? 16000 : 65536))
    return null;
  try {
    const bytes = Uint8Array.from(
      atob(
        (encoded.startsWith("z.") ? encoded.slice(2) : encoded)
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
      ),
      (c) => c.charCodeAt(0),
    );
    const raw = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        encoded.startsWith("z.")
          ? inflateSync(bytes, { out: new Uint8Array(65536) })
          : bytes,
      ),
    );
    if (
      raw.v !== 1 ||
      !GRID_SIZES.includes(raw.g) ||
      !Array.isArray(raw.a) ||
      raw.a.length !== raw.g ||
      typeof raw.n !== "string" ||
      typeof raw.b !== "string" ||
      typeof raw.c !== "boolean"
    )
      return null;
    return normalizePoster({
      gridSize: raw.g,
      title: raw.n,
      background: raw.b,
      showCaptions: raw.c,
      slots: raw.a.map((a: unknown) =>
        Array.isArray(a)
          ? {
              deezerId: a[0],
              title: a[1],
              artist: a[2],
              year: a[3],
              coverLg: a[4],
              coverMd: a[5],
            }
          : null,
      ),
    });
  } catch {
    return null;
  }
}
export function moveSlot(
  slots: (Album | null)[],
  from: number,
  to: number,
): (Album | null)[] {
  const next = [...slots];
  if (
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 0 &&
    to >= 0 &&
    from < slots.length &&
    to < slots.length
  )
    [next[from], next[to]] = [next[to] ?? null, next[from] ?? null];
  return next;
}
export function isDuplicate(
  slots: (Album | null)[],
  album: Album,
  except = -1,
): boolean {
  const key = (a: Album) =>
    `${a.title.trim().toLocaleLowerCase()}\u0000${a.artist.trim().toLocaleLowerCase()}`;
  return slots.some(
    (a, i) =>
      i !== except &&
      a &&
      (a.deezerId === album.deezerId || key(a) === key(album)),
  );
}
export function posterDimensions(
  size: number,
  format: Format,
): [number, number] {
  return format === "story"
    ? [1080, 1920]
    : [1800, 2100 + (size / 3 - 3) * 600];
}
export function readPoster(): { poster: Poster; warning: string | null } {
  let poster = emptyPoster(),
    warning = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) poster = normalizePoster(JSON.parse(saved), true);
  } catch {
    warning =
      "Saved board could not be read. Changes will stay here until you back them up.";
  }
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("poster")) {
    const shared = decodePoster(hash.get("poster")!);
    if (shared) poster = shared;
    else
      warning =
        "This share link is invalid. Your saved board is still available.";
  }
  return { poster, warning };
}
