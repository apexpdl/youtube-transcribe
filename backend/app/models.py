"""Pydantic models defining the public API contract.

These models are the single source of truth for request/response shapes and are
mirrored by the TypeScript types in ``frontend/lib/types.ts``.
"""

from __future__ import annotations

import time
from enum import Enum

from pydantic import BaseModel, Field


class TranscriptSource(str, Enum):
    """Where a transcript was obtained from."""

    captions = "captions"
    whisper = "whisper"


class JobStatus(str, Enum):
    """Lifecycle states for an asynchronous transcription job."""

    queued = "queued"
    processing = "processing"
    downloading = "downloading"
    transcribing = "transcribing"
    completed = "completed"
    failed = "failed"


# --------------------------------------------------------------------------- #
# Core data shapes
# --------------------------------------------------------------------------- #
class TranscriptSegment(BaseModel):
    """A single timestamped chunk of transcript text."""

    text: str
    start: float = Field(..., description="Start time in seconds")
    duration: float = Field(..., description="Duration in seconds")
    end: float = Field(..., description="End time in seconds (start + duration)")


class VideoInfo(BaseModel):
    """Metadata about a YouTube video."""

    video_id: str
    title: str
    channel: str
    thumbnail: str
    duration: str = Field(..., description="Human readable duration, e.g. '12:34'")
    duration_seconds: int
    url: str


# --------------------------------------------------------------------------- #
# Requests
# --------------------------------------------------------------------------- #
class TranscriptRequest(BaseModel):
    """Body for the transcript endpoints."""

    url: str = Field(..., min_length=1, max_length=2048, description="A YouTube video URL")
    language: str | None = Field(
        default=None,
        max_length=16,
        description="Preferred caption language code (e.g. 'en'). Optional.",
    )
    force_whisper: bool = Field(
        default=False,
        description="Skip captions and transcribe with Whisper directly.",
    )


class SummaryRequest(BaseModel):
    """Body for the AI summary endpoint."""

    url: str | None = Field(default=None, max_length=2048)
    video_id: str | None = Field(default=None, max_length=32)
    text: str | None = Field(default=None, max_length=200_000)
    target_language: str | None = Field(
        default=None,
        max_length=32,
        description="If set, the summary/takeaways are produced in this language.",
    )


# --------------------------------------------------------------------------- #
# Responses
# --------------------------------------------------------------------------- #
class TranscriptResponse(BaseModel):
    """The full transcript result returned to the client."""

    video_id: str
    title: str
    channel: str
    thumbnail: str
    duration: str
    duration_seconds: int
    source: TranscriptSource
    language: str | None = None
    transcript: list[TranscriptSegment]
    text: str = Field(..., description="Full transcript as a single plain-text string")
    cached: bool = False


class JobState(BaseModel):
    """The state of an asynchronous transcription job (returned by polling)."""

    job_id: str
    status: JobStatus
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    message: str = ""
    result: TranscriptResponse | None = None
    error: str | None = None
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)


class JobCreatedResponse(BaseModel):
    """Returned immediately when an async job is created."""

    job_id: str
    status: JobStatus = JobStatus.queued


class SummaryResponse(BaseModel):
    """AI-generated summary and key takeaways."""

    summary: str
    takeaways: list[str]
    source: str = Field(..., description="'openai' or 'extractive'")
    target_language: str | None = None


class HealthResponse(BaseModel):
    """Health-check payload."""

    status: str = "ok"
    version: str
    whisper_enabled: bool
    summary_available: bool


class ErrorResponse(BaseModel):
    """Standard error body."""

    detail: str
    code: str | None = None
