"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiHttpError, getJob, getTranscript, startTranscriptJob } from "@/lib/api";
import type { JobState, TranscriptResponse } from "@/lib/types";

const POLL_INTERVAL_MS = 1500;

export type TranscriptFlowState = "idle" | "loading" | "success" | "error";

export interface UseTranscriptResult {
  /** High-level state machine value. */
  state: TranscriptFlowState;
  /** The latest job snapshot from the backend (null before a job starts). */
  job: JobState | null;
  /** The finished transcript, available when `state === "success"`. */
  data: TranscriptResponse | null;
  /** Human-readable error message when `state === "error"`. */
  error: string | null;
  /** Current progress percentage (0–100). */
  progress: number;
  /** Begin a new transcription run. Cancels any in-flight run first. */
  start: (url: string, force?: boolean) => void;
  /** Reset back to the idle state and stop polling. */
  reset: () => void;
}

function isTerminal(status: JobState["status"]): boolean {
  return status === "completed" || status === "failed";
}

/**
 * Orchestrates the async transcription flow: kicks off a job, polls its status
 * on an interval, and surfaces a small state machine to the UI. Polling stops
 * automatically on completion, failure, reset, or unmount.
 */
export function useTranscript(): UseTranscriptResult {
  const [state, setState] = useState<TranscriptFlowState>("idle");
  const [job, setJob] = useState<JobState | null>(null);
  const [data, setData] = useState<TranscriptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Refs for cleanup across renders and async callbacks.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Monotonic run id so stale async callbacks can detect they are obsolete.
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  // Remember the latest request so we can fall back to the synchronous endpoint
  // if the async job can't be polled (e.g. an ephemeral/serverless backend that
  // doesn't keep the in-memory job between requests).
  const requestRef = useRef<{ url: string; force: boolean } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [clearTimer]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    stop();
    setState("idle");
    setJob(null);
    setData(null);
    setError(null);
    setProgress(0);
  }, [stop]);

  const poll = useCallback(
    (jobId: string, runId: number) => {
      const tick = async () => {
        if (runId !== runIdRef.current) return;

        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const next = await getJob(jobId, controller.signal);
          if (runId !== runIdRef.current || !mountedRef.current) return;

          setJob(next);
          // Backend reports progress as a 0–1 fraction; expose it as 0–100%.
          setProgress(clampProgress(next.progress * 100));

          if (next.status === "completed") {
            if (next.result) {
              setData(next.result);
              setState("success");
            } else {
              setError("The job completed but returned no transcript.");
              setState("error");
            }
            clearTimer();
            return;
          }

          if (next.status === "failed") {
            setError(
              next.error ??
                next.message ??
                "Transcription failed. Please try again.",
            );
            setState("error");
            clearTimer();
            return;
          }

          // Still running — schedule the next poll.
          timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        } catch (err) {
          if (
            err instanceof DOMException &&
            err.name === "AbortError"
          ) {
            return; // superseded or unmounted; ignore
          }
          if (runId !== runIdRef.current || !mountedRef.current) return;

          // If the job can't be found (404), the backend likely didn't keep the
          // job between requests (serverless/multi-instance). Fall back to the
          // synchronous endpoint, which does the whole job in one request.
          if (err instanceof ApiHttpError && err.status === 404 && requestRef.current) {
            clearTimer();
            const controller = new AbortController();
            abortRef.current = controller;
            setJob((prev) =>
              prev ? { ...prev, status: "processing", message: "Finishing up…" } : prev,
            );
            try {
              const result = await getTranscript(
                {
                  url: requestRef.current.url,
                  force_whisper: requestRef.current.force,
                },
                controller.signal,
              );
              if (runId !== runIdRef.current || !mountedRef.current) return;
              setData(result);
              setProgress(100);
              setState("success");
            } catch (syncErr) {
              if (syncErr instanceof DOMException && syncErr.name === "AbortError") return;
              if (runId !== runIdRef.current || !mountedRef.current) return;
              setError(
                syncErr instanceof Error
                  ? syncErr.message
                  : "Transcription failed. Please try again.",
              );
              setState("error");
            }
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "A network error occurred while checking job status.",
          );
          setState("error");
          clearTimer();
        }
      };

      // Kick off the first poll on the interval (the job was just created).
      timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    },
    [clearTimer],
  );

  const start = useCallback(
    (url: string, force = false) => {
      const trimmed = url.trim();
      if (!trimmed) return;

      // Supersede any prior run.
      runIdRef.current += 1;
      const runId = runIdRef.current;
      requestRef.current = { url: trimmed, force };
      stop();

      setState("loading");
      setJob(null);
      setData(null);
      setError(null);
      setProgress(0);

      const controller = new AbortController();
      abortRef.current = controller;

      startTranscriptJob(
        { url: trimmed, force_whisper: force },
        controller.signal,
      )
        .then(({ job_id }) => {
          if (runId !== runIdRef.current || !mountedRef.current) return;
          // Seed an initial queued job state for immediate UI feedback.
          setJob({
            job_id,
            status: "queued",
            progress: 0,
            message: "Job queued…",
            result: null,
            error: null,
            created_at: Date.now() / 1000,
            updated_at: Date.now() / 1000,
          });
          poll(job_id, runId);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          if (runId !== runIdRef.current || !mountedRef.current) return;
          setError(
            err instanceof Error
              ? err.message
              : "Failed to start the transcription job.",
          );
          setState("error");
        });
    },
    [poll, stop],
  );

  // Track mount status and clean up on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runIdRef.current += 1;
      clearTimer();
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [clearTimer]);

  return { state, job, data, error, progress, start, reset };
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export { isTerminal };
