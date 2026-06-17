import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes intelligently, resolving conflicts so that later
 * classes win (e.g. `cn("p-2", "p-4")` -> `"p-4"`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a number of seconds as `H:MM:SS` (when there are hours) or `M:SS`.
 * Negative or non-finite values are clamped to 0.
 */
export function formatTimestamp(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
  const rounded = Math.floor(safe);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Format a duration. If a pre-formatted string (e.g. "12:34") is provided it is
 * returned as-is; otherwise a number of seconds is formatted via
 * {@link formatTimestamp}.
 */
export function formatDuration(duration: string | number): string {
  if (typeof duration === "number") {
    return formatTimestamp(duration);
  }
  return duration;
}

/**
 * Trigger a browser download of a text file with the given filename and content.
 * No-op when executed outside the browser (e.g. during SSR).
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8",
): void {
  if (typeof document === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Copy text to the clipboard. Returns `true` on success. Falls back to a
 * hidden textarea + execCommand for browsers/contexts without the async
 * Clipboard API (e.g. insecure origins).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  if (typeof document === "undefined") return false;

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Build a YouTube watch URL that jumps to a specific second.
 * Example: `buildYouTubeTimestampUrl("dQw4w9WgXcQ", 90)`
 *  -> `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s`
 */
export function buildYouTubeTimestampUrl(
  videoId: string,
  seconds: number,
): string {
  const t = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${t}s`;
}

/** Build a canonical YouTube watch URL (no timestamp). */
export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/** Produce a filesystem-safe slug from an arbitrary string. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "transcript"
  );
}
