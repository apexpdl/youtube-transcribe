"""AI summary / key takeaways / translation endpoint."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.config import settings
from app.models import SummaryRequest, SummaryResponse
from app.rate_limit import limiter
from app.services.summary import generate_summary
from app.services.transcript_service import get_transcript

router = APIRouter(prefix="/summary", tags=["summary"])


@router.post("", response_model=SummaryResponse, summary="Summarise a transcript")
@limiter.limit(settings.rate_limit)
def create_summary(
    request: Request, response: Response, payload: SummaryRequest
) -> SummaryResponse:
    """Summarise transcript text into a short summary + key takeaways.

    Accepts either raw ``text`` (preferred — the frontend sends the full
    transcript) or a ``video_id`` / ``url`` to look up the transcript first
    (using the cache when possible).
    """
    text = (payload.text or "").strip()

    if not text:
        source = payload.url or payload.video_id
        if not source:
            raise HTTPException(
                status_code=422,
                detail="Provide transcript 'text', or a 'video_id'/'url' to summarise.",
            )
        # Falls back to fetching the transcript (cache-first inside get_transcript).
        result = get_transcript(source)
        text = result.text

    return generate_summary(text, target_language=payload.target_language)
