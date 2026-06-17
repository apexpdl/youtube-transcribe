"""Transcript endpoints: synchronous fetch + async job + job polling."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.config import settings
from app.logging_config import get_logger
from app.models import (
    JobCreatedResponse,
    JobState,
    TranscriptRequest,
    TranscriptResponse,
)
from app.rate_limit import limiter
from app.services.jobs import job_manager
from app.services.transcript_service import get_transcript

logger = get_logger(__name__)

router = APIRouter(prefix="/transcript", tags=["transcript"])


@router.post("", response_model=TranscriptResponse, summary="Fetch a transcript (synchronous)")
@limiter.limit(settings.rate_limit_transcript)
def create_transcript(
    request: Request, response: Response, payload: TranscriptRequest
) -> TranscriptResponse:
    """Fetch a transcript and return it directly.

    This runs the whole pipeline inline (captions, or a Whisper fallback) and may
    take a while for long videos. The frontend prefers the async flow below, but
    this endpoint is handy for scripting and matches the documented API contract.
    """
    # Run in a threadpool (sync def) so the blocking work doesn't block the loop.
    return get_transcript(
        payload.url,
        language=payload.language,
        force_whisper=payload.force_whisper,
    )


@router.post(
    "/async",
    response_model=JobCreatedResponse,
    summary="Start an async transcription job",
)
@limiter.limit(settings.rate_limit_transcript)
async def create_transcript_async(
    request: Request, response: Response, payload: TranscriptRequest
) -> JobCreatedResponse:
    """Create (or reuse) a background job and return its id for polling."""
    job = job_manager.create_job(
        payload.url,
        language=payload.language,
        force_whisper=payload.force_whisper,
    )
    return JobCreatedResponse(job_id=job.job_id, status=job.status)


@router.get(
    "/jobs/{job_id}",
    response_model=JobState,
    summary="Poll the status/result of a transcription job",
)
async def get_job_status(job_id: str) -> JobState:
    """Return the current state of a job (progress, status, and result)."""
    job = job_manager.get_job(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail="That job was not found or has expired. Please start a new one.",
        )
    return job
