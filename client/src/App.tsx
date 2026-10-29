import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchAlbums } from "./api";
import {
  BACKGROUNDS,
  GRID_SIZES,
  STORAGE_KEY,
  encodePoster,
  isDuplicate,
  moveSlot,
  normalizePoster,
  readPoster,
  type Album,
  type Format,
  type Poster,
} from "./poster";
import { downloadBlob, exportPosterPng, readCover } from "./export";

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        container.current!.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    const preferred =
      container.current!.querySelector<HTMLElement>('input[type="search"]') ??
      focusables()[0];
    preferred?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key === "Tab") {
        const elements = focusables(),
          first = elements[0],
          last = elements.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !container.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !container.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={container}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2>{title}</h2>
          <button
            type="button"
            className="secondary"
            aria-label="Close dialog"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ManualForm({
  slot,
  poster,
  onPick,
  onBack,
}: {
  slot: number;
  poster: Poster;
  onPick: (album: Album) => void;
  onBack: () => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [cover, setCover] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file?: File) {
    if (!file) {
      setCover("");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      setCover(await readCover(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image could not be read.");
      setCover("");
    } finally {
      setUploading(false);
    }
  }

  function addManual(event: React.FormEvent) {
    event.preventDefault();
    const album: Album = {
      deezerId: -Date.now(),
      title: title.trim(),
      artist: artist.trim(),
      year: null,
      coverMd: cover,
      coverLg: cover,
    };
    if (!album.title || !album.artist) {
      setError("Enter an album title and artist.");
      return;
    }
    if (isDuplicate(poster.slots, album, slot)) {
      setError("This album is already on your board.");
      return;
    }
    onPick(album);
  }

  return (
    <form onSubmit={addManual} className="space-y-3 mt-4">
      <label className="field">
        Album title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
      </label>
      <label className="field">
        Artist
        <input
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          required
          maxLength={200}
        />
      </label>
      <label className="field">
        Cover image (optional)
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      <p className="muted text-sm">
        Uploaded covers stay on this device. Shared links include the album
        details without the uploaded image.
      </p>
      {cover && (
        <img
          src={cover}
          alt="Uploaded cover preview"
          className="h-24 w-24 rounded-lg"
        />
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className="primary" disabled={uploading} type="submit">
          {uploading ? "Reading cover…" : "Add album"}
        </button>
        <button className="secondary" type="button" onClick={onBack}>
          Back to search
        </button>
      </div>
    </form>
  );
}

function SearchResults({
  query,
  slot,
  poster,
  onPick,
}: {
  query: string;
  slot: number;
  poster: Poster;
  onPick: (album: Album) => void;
}) {
  const search = useQuery({
    queryKey: ["album-search", query],
    queryFn: ({ signal }) => searchAlbums(query, signal),
    enabled: query.length >= 2,
    staleTime: 60000,
  });

  return (
    <div className="search-results">
      {query.length < 2 && (
        <p className="muted py-8 text-center">
          Start typing to search albums.
        </p>
      )}
      {query.length >= 2 && search.isPending && (
        <p role="status" className="muted py-8 text-center">
          Searching…
        </p>
      )}
      {search.isError && (
        <div className="py-4">
          <p role="alert" className="error">
            {search.error.message}
          </p>
          <button
            className="secondary mt-2"
            onClick={() => void search.refetch()}
          >
            Try search again
          </button>
        </div>
      )}
      {search.isSuccess && query.length >= 2 && search.data.length === 0 && (
        <p className="muted py-8 text-center">
          No albums found. Try the artist name or add it manually.
        </p>
      )}
      {query.length >= 2 && (
        <ul className="grid grid-cols-3 gap-3 py-4">
          {(search.data ?? []).map((album) => {
            const picked = isDuplicate(poster.slots, album, slot);
            return (
              <li key={album.deezerId}>
                <button
                  type="button"
                  className="result"
                  disabled={picked}
                  onClick={() => onPick(album)}
                  aria-label={`Pick ${album.title} by ${album.artist} for slot ${slot + 1}`}
                >
                  <img
                    src={album.coverMd}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  <span className="block truncate font-semibold mt-1 text-xs">
                    {album.title}
                  </span>
                  <span className="block truncate muted text-xs">
                    {album.artist}
                  </span>
                  {picked && (
                    <span className="text-xs text-blue-300">
                      On your board
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SearchSheet({
  slot,
  poster,
  onPick,
  onClose,
}: {
  slot: number;
  poster: Poster;
  onPick: (album: Album) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 350);
    return () => clearTimeout(timer);
  }, [input]);

  return (
    <Dialog title={`#${slot + 1} — find an album`} onClose={onClose}>
      {manual ? (
        <ManualForm
          slot={slot}
          poster={poster}
          onPick={onPick}
          onBack={() => setManual(false)}
        />
      ) : (
        <>
          <label className="field mt-4">
            Search albums by title or artist
            <input
              type="search"
              value={input}
              maxLength={120}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Album or artist — e.g. Crisis"
            />
          </label>
          <SearchResults
            query={query}
            slot={slot}
            poster={poster}
            onPick={onPick}
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
            <span className="muted text-sm">Didn't find your album?</span>
            <button
              type="button"
              className="secondary"
              onClick={() => setManual(true)}
            >
              Add it manually
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

export function App() {
  const [initial] = useState(readPoster);
  const [poster, setPoster] = useState(initial.poster),
    [warning, setWarning] = useState(initial.warning);
  const [selected, setSelected] = useState<number | null>(null),
    [searchSlot, setSearchSlot] = useState<number | null>(null),
    [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [pendingSize, setPendingSize] = useState<number | null>(null),
    [sharing, setSharing] = useState(false),
    [shareUrl, setShareUrl] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    previous?: Poster;
  } | null>(null);
  const dragFrom = useRef<number | null>(null);
  const filled = poster.slots.reduce((acc, slot) => (slot ? acc + 1 : acc), 0),
    complete = filled === poster.gridSize;
  const bg = BACKGROUNDS.find((b) => b.id === poster.background)!;
  const selectedAlbum = selected === null ? null : poster.slots[selected];

  function commit(next: Poster, message?: string, undo = false) {
    setPoster(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setWarning(null);
    } catch {
      setWarning(
        "This board could not be saved on this device. Back it up as JSON to keep your changes.",
      );
    }
    // Once a shared board is edited, reload should use the saved edits, not the original link.
    if (location.hash.startsWith("#poster="))
      history.replaceState(null, "", location.pathname + location.search);
    if (message) setToast({ message, previous: undo ? poster : undefined });
    else
      setToast((current) =>
        current?.previous
          ? {
              ...current,
              previous: {
                ...current.previous,
                title: next.title,
                background: next.background,
                showCaptions: next.showCaptions,
              },
            }
          : current,
      );
  }
  function move(from: number, to: number) {
    if (
      from === to ||
      to < 0 ||
      to >= poster.gridSize ||
      from < 0 ||
      from >= poster.gridSize
    )
      return;
    commit(
      { ...poster, slots: moveSlot(poster.slots, from, to) },
      `Moved to slot ${to + 1}`,
      true,
    );
    setSelected(to);
    setSwapFrom(null);
  }
  function tap(index: number) {
    if (swapFrom !== null) {
      if (index !== swapFrom) move(swapFrom, index);
      setSwapFrom(null);
      return;
    }
    if (!poster.slots[index]) {
      setSearchSlot(index);
      setSelected(null);
    } else setSelected(selected === index ? null : index);
  }
  function pick(album: Album) {
    if (searchSlot === null) return;
    if (isDuplicate(poster.slots, album, searchSlot)) {
      setError("This album is already on your board.");
      return;
    }
    const slots = [...poster.slots];
    slots[searchSlot] = album;
    commit({ ...poster, slots }, `Added to slot ${searchSlot + 1}`, true);
    setSearchSlot(null);
    setSelected(null);
  }
  function remove() {
    if (selected === null) return;
    const slots = [...poster.slots];
    slots[selected] = null;
    commit({ ...poster, slots }, `Removed from slot ${selected + 1}`, true);
    setSelected(null);
  }
  function resize(size: number) {
    const slots = poster.slots.slice(0, size);
    while (slots.length < size) slots.push(null);
    commit(
      { ...poster, gridSize: size, slots },
      `Changed to ${size} albums`,
      true,
    );
    setSelected(null);
    setSwapFrom(null);
    setPendingSize(null);
  }
  async function download(format: Format) {
    setBusy(true);
    setError(null);
    try {
      await exportPosterPng(poster, format);
      setToast({
        message: format === "story" ? "Story downloaded" : "Poster downloaded",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Poster download failed.");
    } finally {
      setBusy(false);
    }
  }
  function share() {
    try {
      const url = new URL(location.href);
      url.hash = `poster=${encodePoster(poster)}`;
      setShareUrl(url.href);
      setSharing(true);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This board could not be shared. Use a JSON backup instead.",
      );
    }
  }
  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast({ message: "Link copied" });
    } catch {
      setToast({ message: "Copy the URL from the field above." });
    }
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 32 * 1024 * 1024)
        throw new Error("Choose a board JSON smaller than 32 MB.");
      const raw = JSON.parse(await file.text());
      if (
        !raw ||
        !GRID_SIZES.includes(raw.gridSize) ||
        !Array.isArray(raw.slots)
      )
        throw new Error("This file is not a board backup.");
      commit(normalizePoster(raw, true), "Board restored", true);
      setError(null);
      setSelected(null);
      setSwapFrom(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This backup could not be read.",
      );
    }
  }

  return (
    <main className="editor">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1>Build your poster</h1>
          <p className="muted mt-2">
            The albums that shaped you, in your order.
          </p>
        </div>
        <span className="saved" role="status">
          {warning ? "Unsaved changes" : "Saved on this device"}
        </span>
      </header>
      {warning && (
        <p role="alert" className="error mt-3">
          {warning}
        </p>
      )}
      <section className="controls mt-6" aria-label="Board settings">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2" role="group" aria-label="Grid size">
            {GRID_SIZES.map((size) => (
              <button
                type="button"
                key={size}
                className={poster.gridSize === size ? "primary" : "secondary"}
                aria-label={`${size} albums`}
                aria-pressed={poster.gridSize === size}
                onClick={() =>
                  poster.slots.slice(size).some(Boolean)
                    ? setPendingSize(size)
                    : resize(size)
                }
              >
                {size}
              </button>
            ))}
          </div>
          <span className="muted" aria-live="polite">
            <strong className="text-[var(--text)]">{filled}</strong> of{" "}
            {poster.gridSize} albums
          </span>
        </div>
        <div
          className="progress mt-4"
          role="progressbar"
          aria-label="Poster progress"
          aria-valuenow={filled}
          aria-valuemin={0}
          aria-valuemax={poster.gridSize}
        >
          <div style={{ width: `${(filled / poster.gridSize) * 100}%` }} />
        </div>
      </section>
      {pendingSize !== null && (
        <div className="controls mt-3">
          <p>
            Shrinking to {pendingSize} removes albums after slot {pendingSize}.
          </p>
          <div className="flex gap-2 mt-3">
            <button className="primary" onClick={() => resize(pendingSize)}>
              Change to {pendingSize}
            </button>
            <button className="secondary" onClick={() => setPendingSize(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <label className="field mt-6">
        Name or @handle <span className="muted text-sm">(optional)</span>
        <input
          value={poster.title}
          maxLength={90}
          placeholder="e.g. @Kayla"
          onChange={(e) => commit({ ...poster, title: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 mt-4 text-sm">
        <input
          type="checkbox"
          checked={poster.showCaptions}
          onChange={(e) =>
            commit({ ...poster, showCaptions: e.target.checked })
          }
        />
        Show album and artist
      </label>
      <section
        className="poster mt-5"
        style={{
          background: bg.color,
          color: bg.light ? "#171717" : "#fafafa",
        }}
        aria-label="Poster preview"
      >
        <h2 className="text-center">{poster.gridSize} albums that made me</h2>
        {poster.title.trim() && (
          <p className="text-center mt-2 text-sm">
            The sound that made {poster.title.trim()}
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {poster.slots.map((album, index) => (
            <figure key={index} className="min-w-0">
              <button
                type="button"
                className={`slot ${selected === index || swapFrom === index ? "active" : ""}`}
                draggable={Boolean(album)}
                onDragStart={(e) => {
                  dragFrom.current = index;
                  e.dataTransfer.setData("text/plain", String(index));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragFrom.current = null;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom.current;
                  if (from !== null) move(from, index);
                  dragFrom.current = null;
                }}
                onClick={() => tap(index)}
                aria-label={
                  album
                    ? `Slot ${index + 1}: ${album.title} by ${album.artist}`
                    : `Slot ${index + 1}: empty — tap to search for an album`
                }
              >
                {album ? (
                  album.coverMd ? (
                    <img src={album.coverMd} alt="" draggable={false} />
                  ) : (
                    <span className="cover-placeholder">
                      {album.title}
                      <small>{album.artist}</small>
                    </span>
                  )
                ) : (
                  <span className="empty-slot">
                    <span aria-hidden="true">＋</span>Add album
                  </span>
                )}
                <span className="rank">{index + 1}</span>
              </button>
              {album && poster.showCaptions && (
                <figcaption className="caption">
                  <strong title={album.title}>{album.title}</strong>
                  <span title={album.artist}>{album.artist}</span>
                </figcaption>
              )}
              {album && (
                <div className="slot-moves">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move slot ${index + 1} back`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === poster.gridSize - 1}
                    aria-label={`Move slot ${index + 1} forward`}
                  >
                    →
                  </button>
                </div>
              )}
            </figure>
          ))}
        </div>
      </section>
      <p className="muted text-sm mt-3 text-center">
        {swapFrom !== null
          ? `Tap a slot to swap with slot ${swapFrom + 1}.`
          : "Tap to edit. Drag covers or use the arrows to reorder."}
      </p>
      {selected !== null && selectedAlbum && (
        <section className="controls mt-3" aria-label="Selected album actions">
          <p>
            <strong>
              #{selected + 1} {selectedAlbum.title}
            </strong>{" "}
            <span className="muted">{selectedAlbum.artist}</span>
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="primary"
              onClick={() => setSearchSlot(selected)}
            >
              Replace
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => move(selected, selected - 1)}
              disabled={selected === 0}
              aria-label="Move back"
            >
              ← Move back
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => move(selected, selected + 1)}
              disabled={selected === poster.gridSize - 1}
              aria-label="Move forward"
            >
              Move forward →
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSwapFrom(selected);
                setSelected(null);
              }}
            >
              Swap…
            </button>
            <button type="button" className="secondary" onClick={remove}>
              Remove
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setSelected(null)}
            >
              Done
            </button>
          </div>
        </section>
      )}
      <section className="mt-6" aria-label="Poster background">
        <h2>Poster background</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          {BACKGROUNDS.map((b) => (
            <button
              type="button"
              key={b.id}
              className={`background ${b.id === poster.background ? "active" : ""}`}
              aria-label={`Background: ${b.label}`}
              aria-pressed={b.id === poster.background}
              onClick={() => commit({ ...poster, background: b.id })}
            >
              <span style={{ background: b.color }} />
              {b.label}
            </button>
          ))}
        </div>
      </section>
      <div className="flex flex-wrap gap-2 mt-7">
        <button
          type="button"
          className="primary"
          disabled={!complete || busy}
          onClick={() => void download("standard")}
        >
          {busy ? "Rendering…" : "Download poster (PNG)"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!complete || busy}
          onClick={() => void download("story")}
        >
          Download story (PNG)
        </button>
      </div>
      <p className="muted text-xs mt-2">
        {complete
          ? "Print-ready poster or 1080 × 1920 story."
          : "Fill every slot to create your poster."}
      </p>
      <div className="flex flex-wrap gap-2 mt-5">
        <button type="button" className="secondary" onClick={share}>
          Share board
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            downloadBlob(
              new Blob([JSON.stringify(poster, null, 2)], {
                type: "application/json",
              }),
              "albums-board.json",
            )
          }
        >
          Back up board
        </button>
        <label className="secondary cursor-pointer">
          Restore board
          <input
            type="file"
            className="sr-only"
            aria-label="Restore board from JSON"
            accept="application/json,.json"
            onChange={(e) => {
              void restore(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            commit(
              { ...poster, slots: Array(poster.gridSize).fill(null) },
              "Board reset",
              true,
            );
            setSelected(null);
            setSwapFrom(null);
          }}
        >
          Reset board
        </button>
      </div>
      {error && (
        <p className="error mt-3" role="alert">
          {error}
        </p>
      )}
      {toast && (
        <div className="toast mt-4" role="status">
          <span>{toast.message}</span>
          {toast.previous && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                commit(toast.previous!);
                setToast({ message: "Change undone" });
                setSelected(null);
                setSwapFrom(null);
              }}
            >
              Undo
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            ✕
          </button>
        </div>
      )}
      <footer className="muted text-xs text-center mt-10">
        Saved on this device · Cover art via Deezer
      </footer>
      {searchSlot !== null && (
        <SearchSheet
          slot={searchSlot}
          poster={poster}
          onPick={pick}
          onClose={() => setSearchSlot(null)}
        />
      )}
      {sharing && (
        <Dialog title="Share your board" onClose={() => setSharing(false)}>
          <p className="muted mt-4 text-sm">
            Anyone with this link can open a copy of your board.
          </p>
          {poster.slots.some((a) => a?.coverLg.startsWith("data:")) && (
            <p className="muted mt-2 text-sm">
              Uploaded covers stay local. This link includes their album details
              only.
            </p>
          )}
          <label className="field mt-4">
            Shareable board URL
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              className="primary"
              onClick={() => void copyShare()}
            >
              Copy link
            </button>
            <a
              className="secondary"
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("The albums that shaped me")}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Post on X
            </a>
          </div>
        </Dialog>
      )}
    </main>
  );
}
