"use client";

import {
  AlignLeft,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  ListOrdered,
} from "lucide-react";
import {
  Fragment,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { SearchBar } from "@/components/SearchBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { exportTranscriptToPdf } from "@/lib/pdf";
import type { TranscriptResponse, TranscriptSegment } from "@/lib/types";
import {
  buildYouTubeTimestampUrl,
  cn,
  copyToClipboard,
  downloadTextFile,
  formatTimestamp,
  slugify,
} from "@/lib/utils";

export interface TranscriptViewerProps {
  data: TranscriptResponse;
  className?: string;
}

type ViewMode = "paragraph" | "timestamped";

interface Paragraph {
  start: number;
  end: number;
  text: string;
  firstIndex: number;
}

const PARAGRAPH_MAX_SECONDS = 45;
const PARAGRAPH_MAX_CHARS = 600;

/** Group consecutive segments into readable paragraphs. */
function buildParagraphs(segments: TranscriptSegment[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let current: { start: number; end: number; parts: string[]; firstIndex: number } | null = null;

  const flush = () => {
    if (current) {
      paragraphs.push({
        start: current.start,
        end: current.end,
        text: current.parts.join(" ").replace(/\s+/g, " ").trim(),
        firstIndex: current.firstIndex,
      });
      current = null;
    }
  };

  segments.forEach((seg, index) => {
    if (!current) {
      current = { start: seg.start, end: seg.end, parts: [seg.text], firstIndex: index };
    } else {
      current.parts.push(seg.text);
      current.end = seg.end;
    }
    const duration = current.end - current.start;
    const charCount = current.parts.join(" ").length;
    const endsSentence = /[.!?]["')\]]?$/.test(seg.text.trim());
    if ((duration >= PARAGRAPH_MAX_SECONDS && endsSentence) || charCount >= PARAGRAPH_MAX_CHARS) {
      flush();
    }
  });
  flush();
  return paragraphs;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Wrap query matches in <mark> for highlighting. */
function highlight(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="mark-highlight">
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

function parseTimeToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  let seconds = 0;
  for (const n of nums) seconds = seconds * 60 + n;
  return seconds;
}

/** Build a plain-text export including a header and timestamps. */
function buildTextExport(data: TranscriptResponse): string {
  const header = [
    data.title,
    data.channel,
    data.duration ? `Duration: ${data.duration}` : "",
    `Source: ${data.source === "whisper" ? "AI transcription (Whisper)" : "YouTube captions"}`,
    `https://www.youtube.com/watch?v=${data.video_id}`,
    "",
    "".padEnd(48, "="),
    "",
  ]
    .filter(Boolean)
    .join("\n");

  const body = data.transcript
    .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text}`)
    .join("\n");

  return `${header}\n${body}\n`;
}

/**
 * The core transcript reader: search + highlight, paragraph/timestamped views,
 * copy, download (.txt), export (PDF), jump-to-timestamp, and per-segment
 * YouTube deep links.
 */
export function TranscriptViewer({ data, className }: TranscriptViewerProps) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("paragraph");
  const [copied, setCopied] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [jumpError, setJumpError] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const segments = data.transcript;
  const paragraphs = useMemo(() => buildParagraphs(segments), [segments]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSegments = useMemo(() => {
    if (!normalizedQuery) return segments.map((seg, index) => ({ seg, index }));
    return segments
      .map((seg, index) => ({ seg, index }))
      .filter(({ seg }) => seg.text.toLowerCase().includes(normalizedQuery));
  }, [segments, normalizedQuery]);

  const filteredParagraphs = useMemo(() => {
    if (!normalizedQuery) return paragraphs;
    return paragraphs.filter((p) => p.text.toLowerCase().includes(normalizedQuery));
  }, [paragraphs, normalizedQuery]);

  // Match count is always measured in segments for a stable, intuitive number.
  const matchCount = useMemo(() => {
    if (!normalizedQuery) return segments.length;
    return segments.filter((seg) => seg.text.toLowerCase().includes(normalizedQuery)).length;
  }, [segments, normalizedQuery]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(data.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadTxt = () => {
    downloadTextFile(`${slugify(data.title || data.video_id)}-transcript.txt`, buildTextExport(data));
  };

  const handleExportPdf = () => {
    exportTranscriptToPdf(data);
  };

  const findNearestSegmentIndex = (seconds: number): number => {
    let idx = 0;
    for (let i = 0; i < segments.length; i += 1) {
      if (segments[i].start <= seconds) idx = i;
      else break;
    }
    return idx;
  };

  const flashSegment = (index: number) => {
    const el = document.getElementById(`segment-${index}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Restart the CSS flash animation.
    el.classList.remove("segment-flash");
    void el.offsetWidth; // force reflow
    el.classList.add("segment-flash");
  };

  const jumpToSeconds = (seconds: number) => {
    setQuery(""); // ensure the target isn't filtered out
    setViewMode("timestamped");
    const index = findNearestSegmentIndex(seconds);
    // Wait a tick for the timestamped list to render before scrolling.
    window.setTimeout(() => flashSegment(index), 70);
  };

  const handleJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const seconds = parseTimeToSeconds(jumpValue);
    if (seconds === null) {
      setJumpError(true);
      return;
    }
    setJumpError(false);
    jumpToSeconds(seconds);
  };

  return (
    <section
      className={cn("surface-card animate-fade-in overflow-hidden", className)}
      aria-label="Transcript"
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Transcript</h2>
            <Badge variant="muted">{segments.length} segments</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              leftIcon={
                copied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )
              }
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTxt}
              leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
            >
              .txt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              leftIcon={<FileDown className="h-4 w-4" aria-hidden="true" />}
            >
              PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <SearchBar
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
              matchCount={matchCount}
              totalCount={segments.length}
            />
          </div>

          {/* Jump to timestamp */}
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Clock
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                inputMode="numeric"
                value={jumpValue}
                onChange={(event) => {
                  setJumpValue(event.target.value);
                  setJumpError(false);
                }}
                placeholder="Jump to m:ss"
                aria-label="Jump to timestamp"
                aria-invalid={jumpError || undefined}
                className={cn(
                  "h-10 w-32 rounded-lg border bg-card pl-8 pr-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/80 focus:ring-2 focus:ring-primary/30",
                  jumpError ? "border-red-500 focus:border-red-500" : "border-border focus:border-primary",
                )}
              />
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Go
            </Button>
          </form>

          {/* View toggle */}
          <div
            className="inline-flex rounded-lg border border-border p-0.5"
            role="tablist"
            aria-label="Transcript view mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "paragraph"}
              onClick={() => setViewMode("paragraph")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === "paragraph"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <AlignLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Paragraphs</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "timestamped"}
              onClick={() => setViewMode("timestamped")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === "timestamped"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Timestamps</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        ref={listRef}
        className="scrollbar-slim max-h-[70vh] overflow-y-auto p-4 sm:p-6"
      >
        {matchCount === 0 && normalizedQuery ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No segments match &ldquo;{query}&rdquo;.
          </p>
        ) : viewMode === "paragraph" ? (
          <div className="space-y-5">
            {filteredParagraphs.map((para) => (
              <div key={para.firstIndex} className="group flex gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => jumpToSeconds(para.start)}
                  className="mt-0.5 h-fit flex-shrink-0 rounded-md px-2 py-1 font-mono text-xs font-medium tabular-nums text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Jump to ${formatTimestamp(para.start)}`}
                >
                  {formatTimestamp(para.start)}
                </button>
                <p className="flex-1 leading-relaxed text-foreground/90">
                  {highlight(para.text, query)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <ol className="space-y-1">
            {filteredSegments.map(({ seg, index }) => (
              <li
                key={index}
                id={`segment-${index}`}
                className="flex scroll-mt-24 gap-3 rounded-lg p-2 transition-colors hover:bg-foreground/[0.03] sm:gap-4"
              >
                <a
                  href={buildYouTubeTimestampUrl(data.video_id, seg.start)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-0.5 inline-flex h-fit flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 font-mono text-xs font-medium tabular-nums text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="Open on YouTube at this time"
                >
                  {formatTimestamp(seg.start)}
                  <ExternalLink
                    className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </a>
                <p className="flex-1 leading-relaxed text-foreground/90">
                  {highlight(seg.text, query)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

export default TranscriptViewer;
