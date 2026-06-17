"use client";

import {
  Captions,
  Download,
  Languages,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorAlert } from "@/components/ErrorAlert";
import { LoadingProgress } from "@/components/LoadingProgress";
import { SummaryPanel } from "@/components/SummaryPanel";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { UrlForm } from "@/components/UrlForm";
import { VideoInfoCard } from "@/components/VideoInfoCard";
import { useTranscript } from "@/hooks/useTranscript";
import { buildYouTubeWatchUrl } from "@/lib/utils";
import { extractVideoId } from "@/lib/youtube";

const FEATURES = [
  { icon: Captions, label: "Auto-detect captions" },
  { icon: Sparkles, label: "Whisper AI fallback" },
  { icon: Search, label: "Search & jump to time" },
  { icon: Languages, label: "AI summary & translate" },
  { icon: Download, label: "Export TXT / PDF" },
  { icon: Zap, label: "Cached & fast" },
];

export function Home() {
  const searchParams = useSearchParams();
  const { state, job, data, error, progress, start, reset } = useTranscript();

  const [initialUrl, setInitialUrl] = useState("");
  const lastRequest = useRef<{ url: string; force: boolean } | null>(null);
  const autoStarted = useRef(false);

  const handleSubmit = useCallback(
    (url: string, forceWhisper: boolean) => {
      lastRequest.current = { url, force: forceWhisper };
      start(url, forceWhisper);
    },
    [start],
  );

  const handleRetry = useCallback(() => {
    if (lastRequest.current) {
      start(lastRequest.current.url, lastRequest.current.force);
    } else {
      reset();
    }
  }, [reset, start]);

  // Auto-start from a shareable link (?v=<id> or ?url=<encoded>).
  useEffect(() => {
    if (autoStarted.current) return;
    const v = searchParams.get("v");
    const urlParam = searchParams.get("url");

    let url = "";
    if (urlParam) {
      url = urlParam;
    } else if (v && extractVideoId(v)) {
      url = buildYouTubeWatchUrl(v);
    }

    if (url) {
      autoStarted.current = true;
      setInitialUrl(url);
      lastRequest.current = { url, force: false };
      start(url, false);
    }
  }, [searchParams, start]);

  // Keep the browser URL in sync so the page is shareable.
  useEffect(() => {
    if (state === "success" && data && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("v") !== data.video_id) {
        params.delete("url");
        params.set("v", data.video_id);
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}?${params.toString()}`,
        );
      }
    }
  }, [state, data]);

  const isLoading = state === "loading";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Turn any YouTube video into{" "}
          <span className="text-primary">text</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
          Paste a link and get an accurate transcript in seconds. We use existing
          captions when available and fall back to AI speech-to-text when they
          aren&apos;t.
        </p>

        <div className="mx-auto mt-8 max-w-2xl">
          <UrlForm
            onSubmit={handleSubmit}
            loading={isLoading}
            initialUrl={initialUrl}
          />
        </div>

        {state === "idle" && (
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {feature.label}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Results / status */}
      <div className="mt-10 space-y-6">
        {isLoading && (
          <LoadingProgress
            progress={progress}
            status={job?.status}
            message={job?.message}
          />
        )}

        {state === "error" && error && (
          <ErrorAlert message={error} onRetry={handleRetry} />
        )}

        {state === "success" && data && (
          <>
            <VideoInfoCard data={data} />
            <SummaryPanel videoId={data.video_id} text={data.text} />
            <TranscriptViewer data={data} />
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
