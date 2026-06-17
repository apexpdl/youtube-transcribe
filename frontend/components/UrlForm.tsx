"use client";

import { Link2, Sparkles, X } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { isValidYouTubeUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

export interface UrlFormProps {
  /** Called with a validated URL and the force-whisper preference. */
  onSubmit: (url: string, forceWhisper: boolean) => void;
  /** Disables inputs and shows the submit button as busy. */
  loading?: boolean;
  /** Pre-fill the input (e.g. from a shareable link). */
  initialUrl?: string;
  className?: string;
}

/**
 * YouTube URL entry form with client-side validation and an optional
 * "Force AI transcription (Whisper)" toggle.
 */
export function UrlForm({
  onSubmit,
  loading = false,
  initialUrl = "",
  className,
}: UrlFormProps) {
  const [url, setUrl] = useState(initialUrl);
  const [forceWhisper, setForceWhisper] = useState(false);
  const [touched, setTouched] = useState(false);

  const inputId = useId();
  const errorId = useId();
  const checkboxId = useId();

  // Keep the field in sync if an initial URL arrives after mount.
  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  const trimmed = url.trim();
  const isEmpty = trimmed.length === 0;
  const isValid = !isEmpty && isValidYouTubeUrl(trimmed);
  const showError = touched && !isEmpty && !isValid;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!isValid || loading) return;
    onSubmit(trimmed, forceWhisper);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("w-full", className)}
      noValidate
      aria-label="Transcribe a YouTube video"
    >
      <label htmlFor={inputId} className="sr-only">
        YouTube video URL
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Link2
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a YouTube link (e.g. https://youtu.be/dQw4w9WgXcQ)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            disabled={loading}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? errorId : undefined}
            className={cn(
              "h-12 w-full rounded-xl border bg-card pl-11 pr-10 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60",
              showError
                ? "border-red-500 focus:border-red-500 focus:ring-red-500/30"
                : "border-border",
            )}
          />
          {url.length > 0 && !loading && (
            <button
              type="button"
              onClick={() => {
                setUrl("");
                setTouched(false);
              }}
              aria-label="Clear URL"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          loading={loading}
          disabled={isEmpty}
          leftIcon={!loading ? <Sparkles className="h-5 w-5" aria-hidden="true" /> : undefined}
          className="sm:w-auto"
        >
          {loading ? "Transcribing…" : "Transcribe"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={checkboxId}
          className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={forceWhisper}
            onChange={(e) => setForceWhisper(e.target.checked)}
            disabled={loading}
            className="h-4 w-4 cursor-pointer rounded border-border text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          />
          Force AI transcription (Whisper)
        </label>

        <span
          id={errorId}
          role={showError ? "alert" : undefined}
          className={cn(
            "text-sm text-red-600 dark:text-red-400 transition-opacity",
            showError ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          Please enter a valid YouTube URL.
        </span>
      </div>
    </form>
  );
}

export default UrlForm;
