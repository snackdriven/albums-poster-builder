import type { Album } from "./poster";
import { safeCover } from "./poster";

// Deezer's JSONP endpoint lets a static site search without a proxy or API key.
// It is securely executed inside a sandboxed iframe to prevent XSS vulnerabilities.
export function searchAlbums(
  query: string,
  signal?: AbortSignal,
): Promise<Album[]> {
  return new Promise((resolve, reject) => {
    const callback = `albumSearch_${crypto.randomUUID().replace(/-/g, "")}`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.display = "none";

    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      signal?.removeEventListener("abort", abort);
    };

    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };

    const abort = () =>
      fail(new DOMException("Search cancelled", "AbortError"));

    const timer = setTimeout(
      () =>
        fail(
          new Error("Search timed out. Try again or add the album manually."),
        ),
      12000,
    );

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== "null" && event.origin !== window.origin) return;
      const payload = event.data;

      if (payload && payload.type === "error") {
        fail(
          new Error(
            "Search failed. Check your connection or add the album manually.",
          ),
        );
        return;
      }

      cleanup();
      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray((payload as { data?: unknown }).data)
      ) {
        reject(
          new Error(
            "Album search is unavailable. Try again or add it manually.",
          ),
        );
        return;
      }

      const results: Album[] = [],
        seen = new Set<number>();
      for (const item of (payload as { data: unknown[] }).data) {
        if (!item || typeof item !== "object") continue;
        const a = item as Record<string, unknown>;
        const coverMd = safeCover(
          typeof a.cover_big === "string" ? a.cover_big : "",
        );
        const coverLg = safeCover(
          typeof a.cover_xl === "string" ? a.cover_xl : coverMd,
        );
        if (
          typeof a.id !== "number" ||
          !Number.isInteger(a.id) ||
          typeof a.title !== "string" ||
          !a.title ||
          !coverMd ||
          seen.has(a.id)
        )
          continue;
        seen.add(a.id);
        results.push({
          deezerId: a.id,
          title: a.title.slice(0, 200),
          artist:
            a.artist &&
            typeof a.artist === "object" &&
            "name" in a.artist &&
            typeof a.artist.name === "string"
              ? a.artist.name.slice(0, 200)
              : "",
          year: null,
          coverMd,
          coverLg,
        });
      }
      resolve(results);
    };

    window.addEventListener("message", onMessage);
    signal?.addEventListener("abort", abort, { once: true });

    if (signal?.aborted) {
      abort();
      return;
    }

    const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(query.trim().slice(0, 120))}&limit=24&output=jsonp&callback=${callback}`;
    iframe.srcdoc = `<script>
      window["${callback}"] = function(data) {
        window.parent.postMessage(data, "${window.location.origin}");
      };
      const s = document.createElement("script");
      s.src = "${url}";
      s.onerror = function() { window.parent.postMessage({ type: "error" }, "${window.location.origin}"); };
      document.head.append(s);
    </script>`;

    document.body.append(iframe);
  });
}
