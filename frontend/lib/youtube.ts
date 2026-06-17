/**
 * Utilities for validating YouTube URLs and extracting the 11-character
 * video id from the many shapes YouTube links take:
 *  - https://www.youtube.com/watch?v=VIDEOID
 *  - https://youtu.be/VIDEOID
 *  - https://www.youtube.com/embed/VIDEOID
 *  - https://www.youtube.com/shorts/VIDEOID
 *  - https://www.youtube.com/live/VIDEOID
 *  - with or without query params, http/https, with or without www / m.
 */

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/** Path prefixes that carry the video id as the next path segment. */
const PATH_PREFIXES = ["embed", "shorts", "live", "v", "e"];

function normalizeId(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  return VIDEO_ID_RE.test(trimmed) ? trimmed : null;
}

/**
 * Extract the YouTube video id from a URL (or a bare 11-char id).
 * Returns `null` when no valid id can be found.
 */
export function extractVideoId(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Allow passing a bare video id directly.
  const bare = normalizeId(raw);
  if (bare) return bare;

  // Ensure the URL parser has a protocol to work with.
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  // youtu.be/VIDEOID
  if (host === "youtu.be" || host === "www.youtu.be") {
    const seg = url.pathname.split("/").filter(Boolean)[0];
    return normalizeId(seg);
  }

  // youtube.com/watch?v=VIDEOID
  const vParam = normalizeId(url.searchParams.get("v"));
  if (vParam) return vParam;

  // youtube.com/embed|shorts|live|v|e/VIDEOID
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0].toLowerCase())) {
    const fromPath = normalizeId(segments[1]);
    if (fromPath) return fromPath;
  }

  // Some share links use /shorts/VIDEOID?... already handled above; also
  // handle the case where the id is the only path segment on a youtube host.
  if (segments.length === 1) {
    const only = normalizeId(segments[0]);
    if (only) return only;
  }

  return null;
}

/** Returns `true` when the given string resolves to a valid YouTube video id. */
export function isValidYouTubeUrl(input: string): boolean {
  return extractVideoId(input) !== null;
}

/** Normalize any valid YouTube URL/id to a canonical watch URL, or null. */
export function toCanonicalWatchUrl(input: string): string | null {
  const id = extractVideoId(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}
