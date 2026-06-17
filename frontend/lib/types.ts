export type TranscriptSource = "captions" | "whisper";

export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
  end: number;
}

export interface TranscriptResponse {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string;
  duration_seconds: number;
  source: TranscriptSource;
  language: string | null;
  transcript: TranscriptSegment[];
  text: string;
  cached: boolean;
}

export type JobStatus =
  | "queued"
  | "processing"
  | "downloading"
  | "transcribing"
  | "completed"
  | "failed";

export interface JobState {
  job_id: string;
  status: JobStatus;
  progress: number;
  message: string;
  result: TranscriptResponse | null;
  error: string | null;
  created_at: number;
  updated_at: number;
}

export interface SummaryResponse {
  summary: string;
  takeaways: string[];
  source: string;
  target_language: string | null;
}

export interface ApiError {
  detail: string;
  code?: string | null;
}

/** Payload accepted by the transcript endpoints. */
export interface TranscriptRequest {
  url: string;
  language?: string | null;
  force_whisper?: boolean;
}

/** Payload accepted by the summary endpoint. */
export interface SummaryRequest {
  video_id?: string;
  text?: string;
  target_language?: string | null;
}

/** Response of POST /api/transcript/async. */
export interface AsyncJobCreated {
  job_id: string;
}

/** Response of GET /api/health. */
export interface HealthResponse {
  status: string;
}
