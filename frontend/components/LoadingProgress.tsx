"use client";

import { Captions, Cloud, Download, Loader2, Sparkles } from "lucide-react";

import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface LoadingProgressProps {
  /** Progress percentage, 0–100. */
  progress: number;
  /** Current backend job status. */
  status?: JobStatus;
  /** Human-readable status message from the backend. */
  message?: string;
  className?: string;
}

const STEPS: { key: JobStatus; label: string; icon: typeof Cloud }[] = [
  { key: "queued", label: "Queued", icon: Loader2 },
  { key: "downloading", label: "Downloading audio", icon: Download },
  { key: "transcribing", label: "Transcribing (AI)", icon: Sparkles },
  { key: "completed", label: "Done", icon: Captions },
];

function activeStepIndex(status?: JobStatus): number {
  switch (status) {
    case "queued":
      return 0;
    case "processing":
      return 0;
    case "downloading":
      return 1;
    case "transcribing":
      return 2;
    case "completed":
      return 3;
    default:
      return 0;
  }
}

/**
 * A progress card shown while a transcription job runs. Renders a determinate
 * progress bar (driven by the backend's 0–100 progress) plus a friendly,
 * animated status line.
 */
export function LoadingProgress({
  progress,
  status,
  message,
  className,
}: LoadingProgressProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  const isFailed = status === "failed";
  const activeIdx = activeStepIndex(status);

  return (
    <section
      aria-live="polite"
      aria-busy={!isFailed}
      className={cn(
        "surface-card animate-fade-in p-6 sm:p-8",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Cloud className="h-5 w-5" aria-hidden="true" />
          <Loader2
            className="absolute inset-0 m-auto h-11 w-11 animate-spin text-primary/30"
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-foreground">Fetching your transcript…</p>
          <p className="truncate text-sm text-muted-foreground">
            {message || "Working on it. This can take a moment for longer videos."}
          </p>
        </div>
        <span className="ml-auto text-2xl font-semibold tabular-nums text-foreground">
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        >
          <div className="h-full w-full animate-progress-stripes bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,0.25)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.25)_50%,rgba(255,255,255,0.25)_75%,transparent_75%,transparent)]" />
        </div>
      </div>

      {/* Steps */}
      <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const done = idx < activeIdx;
          const active = idx === activeIdx && !isFailed;
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                done && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                active && "border-primary/30 bg-primary/10 text-primary",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              <Icon
                className={cn("h-4 w-4 flex-shrink-0", active && "animate-pulse")}
                aria-hidden="true"
              />
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default LoadingProgress;
