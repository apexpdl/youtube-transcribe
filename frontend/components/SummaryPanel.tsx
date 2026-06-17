"use client";

import { Info, Languages, Lightbulb, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { getSummary } from "@/lib/api";
import type { SummaryResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SummaryPanelProps {
  videoId: string;
  text: string;
  className?: string;
}

/** Supported translation targets. `null` means "original language". */
const LANGUAGES: { label: string; value: string | null }[] = [
  { label: "Original", value: null },
  { label: "English", value: "English" },
  { label: "Spanish", value: "Spanish" },
  { label: "French", value: "French" },
  { label: "German", value: "German" },
  { label: "Hindi", value: "Hindi" },
  { label: "Japanese", value: "Japanese" },
  { label: "Chinese", value: "Chinese" },
];

/**
 * Generates an AI summary + key takeaways for the transcript, with an optional
 * translation target. Degrades gracefully when the backend has no AI key (it
 * returns an "extractive" summary, which we label accordingly).
 */
export function SummaryPanel({ videoId, text, className }: SummaryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryResponse | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  const generate = useCallback(
    async (targetLanguage: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const summary = await getSummary({
          video_id: videoId,
          text,
          target_language: targetLanguage,
        });
        setResult(summary);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate the summary. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    },
    [text, videoId],
  );

  const handleLanguageChange = (value: string) => {
    const next = value === "" ? null : value;
    setLanguage(next);
    // Re-generate immediately if we already have a summary.
    if (result) void generate(next);
  };

  return (
    <section
      className={cn("surface-card animate-fade-in p-5 sm:p-6", className)}
      aria-label="AI summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">AI Summary &amp; Key Takeaways</h2>
            <p className="text-xs text-muted-foreground">
              Condense the video into a short summary and bullet points.
            </p>
          </div>
        </div>

        {result && (
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Languages className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Translate summary to</span>
            <select
              value={language ?? ""}
              onChange={(event) => handleLanguageChange(event.target.value)}
              disabled={loading}
              className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.label} value={lang.value ?? ""}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Initial CTA */}
      {!result && !loading && (
        <div className="mt-5">
          <Button
            onClick={() => generate(language)}
            leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          >
            Generate AI Summary
          </Button>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-6 flex items-center gap-3 text-muted-foreground">
          <Spinner size={20} />
          <span className="text-sm">Analyzing the transcript…</span>
        </div>
      )}

      {/* Error after a previous result */}
      {error && result && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="mt-5 space-y-5">
          {result.source === "extractive" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <p>
                This is a basic extractive summary. Configure an OpenAI API key on
                the backend for higher-quality AI summaries and translation.
              </p>
            </div>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
              <Badge variant="muted">
                {result.source === "openai" ? "AI" : "Extractive"}
              </Badge>
            </h3>
            <p className="leading-relaxed text-foreground">{result.summary}</p>
          </div>

          {result.takeaways.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                Key Takeaways
              </h3>
              <ul className="space-y-2">
                {result.takeaways.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground"
                  >
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default SummaryPanel;
