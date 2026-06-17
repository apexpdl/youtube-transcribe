"use client";

import {
  Captions,
  Check,
  Clock,
  ExternalLink,
  Share2,
  Sparkles,
  User,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { TranscriptResponse } from "@/lib/types";
import { buildYouTubeWatchUrl, cn, copyToClipboard } from "@/lib/utils";

export interface VideoInfoCardProps {
  data: TranscriptResponse;
  className?: string;
}

/**
 * Displays video metadata (thumbnail, title, channel, duration) plus badges for
 * the transcript source/language and actions to open on YouTube or copy a
 * shareable link.
 */
export function VideoInfoCard({ data, className }: VideoInfoCardProps) {
  const [shared, setShared] = useState(false);
  const watchUrl = buildYouTubeWatchUrl(data.video_id);

  const handleShare = async () => {
    // The page keeps `?v=<id>` in the URL, so the current location is shareable.
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}?v=${data.video_id}`
        : watchUrl;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: data.title, url: shareUrl });
        return;
      } catch {
        // user cancelled or unsupported — fall back to clipboard
      }
    }
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <section
      className={cn(
        "surface-card animate-fade-in overflow-hidden",
        className,
      )}
      aria-label="Video information"
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
        {/* Thumbnail */}
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative block aspect-video w-full flex-shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-64"
          aria-label={`Watch "${data.title}" on YouTube`}
        >
          <Image
            src={data.thumbnail}
            alt={data.title}
            fill
            sizes="(max-width: 640px) 100vw, 256px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
          {data.duration && (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
              {data.duration}
            </span>
          )}
        </a>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            {data.source === "captions" ? (
              <Badge variant="primary">
                <Captions className="h-3.5 w-3.5" aria-hidden="true" />
                YouTube captions
              </Badge>
            ) : (
              <Badge variant="warning">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                AI transcription
              </Badge>
            )}
            {data.language && (
              <Badge variant="muted">{data.language.toUpperCase()}</Badge>
            )}
            {data.cached && <Badge variant="success">Cached</Badge>}
          </div>

          <h2 className="mt-2 line-clamp-3 text-balance text-xl font-bold leading-snug text-foreground">
            {data.title}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4" aria-hidden="true" />
              {data.channel}
            </span>
            {data.duration && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {data.duration}
              </span>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              leftIcon={
                shared ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                )
              }
            >
              {shared ? "Link copied!" : "Copy share link"}
            </Button>
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Watch on YouTube
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default VideoInfoCard;
