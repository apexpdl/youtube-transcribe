import type {
  ApiError,
  AsyncJobCreated,
  HealthResponse,
  JobState,
  SummaryRequest,
  SummaryResponse,
  TranscriptRequest,
  TranscriptResponse,
} from "@/lib/types";

const DEFAULT_API_URL = "http://localhost:8000";

/** An error carrying the HTTP status, so callers can react to specific codes. */
export class ApiHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

/**
 * Resolve the backend base URL from the public env var, trimming any trailing
 * slash so we can safely concatenate paths.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  const base = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_API_URL;
  return base.replace(/\/+$/, "");
}

/** Build a fully-qualified URL for a backend path (which should start with "/"). */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "detail" in value &&
    typeof (value as Record<string, unknown>).detail === "string"
  );
}

/**
 * Attempt to pull a human-readable message out of a non-OK response body.
 * Handles FastAPI's `{ "detail": "..." }`, validation arrays, and plain text.
 */
async function extractErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body: unknown = await response.json();
      if (isApiError(body)) {
        return body.detail;
      }
      if (
        typeof body === "object" &&
        body !== null &&
        "detail" in body
      ) {
        const detail = (body as Record<string, unknown>).detail;
        // FastAPI validation errors return an array of error objects.
        if (Array.isArray(detail)) {
          const msgs = detail
            .map((item) => {
              if (
                typeof item === "object" &&
                item !== null &&
                "msg" in item &&
                typeof (item as Record<string, unknown>).msg === "string"
              ) {
                return (item as Record<string, unknown>).msg as string;
              }
              return null;
            })
            .filter((m): m is string => Boolean(m));
          if (msgs.length > 0) return msgs.join("; ");
        }
        if (typeof detail === "string" && detail.length > 0) {
          return detail;
        }
      }
    } catch {
      // ignore JSON parse errors and use fallback
    }
  } else {
    try {
      const text = await response.text();
      if (text.trim().length > 0) {
        return text.trim().slice(0, 500);
      }
    } catch {
      // ignore
    }
  }

  return fallback;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Core fetch wrapper: serializes JSON bodies, parses JSON responses, and throws
 * an `Error` carrying a human-friendly message on failure.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new Error(
      "Unable to reach the transcription service. Please check that the backend is running and try again.",
    );
  }

  if (!response.ok) {
    const fallback = `Request failed with status ${response.status} (${response.statusText || "error"}).`;
    const message = await extractErrorMessage(response, fallback);
    throw new ApiHttpError(message, response.status);
  }

  // 204 No Content or empty body.
  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Received an invalid response from the server.");
  }
}

/**
 * Start an asynchronous transcription job.
 * POST /api/transcript/async
 */
export function startTranscriptJob(
  payload: TranscriptRequest,
  signal?: AbortSignal,
): Promise<AsyncJobCreated> {
  return request<AsyncJobCreated>("/api/transcript/async", {
    method: "POST",
    body: {
      url: payload.url,
      language: payload.language ?? null,
      force_whisper: payload.force_whisper ?? false,
    },
    signal,
  });
}

/**
 * Poll the state of a transcription job.
 * GET /api/transcript/jobs/{jobId}
 */
export function getJob(jobId: string, signal?: AbortSignal): Promise<JobState> {
  return request<JobState>(
    `/api/transcript/jobs/${encodeURIComponent(jobId)}`,
    { method: "GET", signal },
  );
}

/**
 * Synchronously fetch a transcript. Exported for completeness; the UI prefers
 * the async + poll flow via {@link startTranscriptJob} / {@link getJob}.
 * POST /api/transcript
 */
export function getTranscript(
  payload: TranscriptRequest,
  signal?: AbortSignal,
): Promise<TranscriptResponse> {
  return request<TranscriptResponse>("/api/transcript", {
    method: "POST",
    body: {
      url: payload.url,
      language: payload.language ?? null,
      force_whisper: payload.force_whisper ?? false,
    },
    signal,
  });
}

/**
 * Generate an AI summary (and optional translation) of a transcript.
 * POST /api/summary
 */
export function getSummary(
  payload: SummaryRequest,
  signal?: AbortSignal,
): Promise<SummaryResponse> {
  return request<SummaryResponse>("/api/summary", {
    method: "POST",
    body: {
      video_id: payload.video_id,
      text: payload.text,
      target_language: payload.target_language ?? null,
    },
    signal,
  });
}

/**
 * Health check.
 * GET /api/health
 */
export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/api/health", { method: "GET", signal });
}
