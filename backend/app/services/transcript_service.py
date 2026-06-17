"""Orchestrates the full transcript pipeline.

Flow:
    1. Validate URL -> video ID.
    2. Return a cached result if available.
    3. Fetch video metadata (yt-dlp).
    4. Try existing captions (youtube-transcript-api) unless ``force_whisper``.
    5. Fall back to downloading audio (yt-dlp) and transcribing with Whisper.
    6. Cache and return the result.

A ``progress`` callback ``(fraction: float, message: str)`` is threaded through
so the async job runner can surface live progress to the client.
"""

from __future__ import annotations

from collections.abc import Callable

from app.config import settings
from app.exceptions import (
    CaptionsUnavailableError,
    TranscriptUnavailableError,
    VideoTooLongError,
    WhisperUnavailableError,
)
from app.logging_config import get_logger
from app.models import TranscriptResponse, TranscriptSource, VideoInfo
from app.services import captions as captions_service
from app.services import whisper_service, ytdlp_service
from app.services.cache import transcript_cache
from app.utils.files import temp_workdir
from app.utils.text import build_segments, segments_to_text
from app.utils.url_parser import extract_video_id

logger = get_logger(__name__)

# A progress callback: takes a fraction in [0, 1] and a status message.
ProgressFn = Callable[[float, str], None]


def _noop_progress(fraction: float, message: str) -> None:  # pragma: no cover
    """Default no-op progress reporter."""


def get_transcript(
    url: str,
    *,
    language: str | None = None,
    force_whisper: bool = False,
    progress: ProgressFn | None = None,
) -> TranscriptResponse:
    """Run the full pipeline and return a :class:`TranscriptResponse`."""
    report = progress or _noop_progress

    video_id = extract_video_id(url)
    report(0.02, "Validating video…")

    # 1) Cache check (skip duplicate processing entirely).
    cached = transcript_cache.get(video_id, force_whisper=force_whisper, language=language)
    if cached is not None:
        report(1.0, "Loaded from cache.")
        return cached

    # 2) Metadata (also acts as an availability/permission check).
    report(0.08, "Fetching video information…")
    info = ytdlp_service.get_video_info(video_id)

    # 3) Captions first (fast path), unless the caller forces Whisper.
    if not force_whisper:
        try:
            report(0.2, "Looking for existing captions…")
            raw, lang_code = captions_service.fetch_captions(video_id, language=language)
            response = _build_response(
                info, raw, source=TranscriptSource.captions, language=lang_code
            )
            transcript_cache.set(response, force_whisper=force_whisper, language=language)
            report(1.0, "Transcript ready (captions).")
            return response
        except CaptionsUnavailableError:
            logger.info("No captions for %s, falling back to Whisper.", video_id)
            report(0.3, "No captions found. Falling back to AI transcription…")
        # Other caption errors (private/region/etc.) propagate up to the router.

    # 4) Whisper fallback.
    response = _transcribe_with_whisper(info, language=language, report=report)
    transcript_cache.set(response, force_whisper=force_whisper, language=language)
    report(1.0, "Transcript ready (AI).")
    return response


def _transcribe_with_whisper(
    info: VideoInfo, *, language: str | None, report: ProgressFn
) -> TranscriptResponse:
    """Download audio and run Whisper, returning a response."""
    if not whisper_service.is_available():
        raise WhisperUnavailableError(
            "This video has no captions and AI transcription is unavailable on the server."
        )

    if (
        settings.max_whisper_duration_seconds
        and info.duration_seconds
        and info.duration_seconds > settings.max_whisper_duration_seconds
    ):
        raise VideoTooLongError(
            "This video is too long for AI transcription. "
            f"Maximum is {settings.max_whisper_duration_seconds // 60} minutes."
        )

    with temp_workdir(prefix=f"tt-{info.video_id}-") as workdir:
        # Download (0.3 -> 0.6 of the bar).
        def _dl_progress(frac: float, msg: str) -> None:
            report(0.3 + 0.3 * max(0.0, min(frac, 1.0)), msg)

        audio_path = ytdlp_service.download_audio(
            info.video_id, workdir, progress_hook=_dl_progress
        )

        # Transcribe (0.6 -> 1.0 of the bar).
        def _tr_progress(frac: float, msg: str) -> None:
            report(0.6 + 0.4 * max(0.0, min(frac, 1.0)), msg)

        raw = whisper_service.transcribe(
            audio_path, language=language, progress_hook=_tr_progress
        )

    return _build_response(
        info, raw, source=TranscriptSource.whisper, language=language
    )
    # NOTE: temp_workdir cleans up the downloaded audio automatically.


def _build_response(
    info: VideoInfo,
    raw_segments: list[dict],
    *,
    source: TranscriptSource,
    language: str | None,
) -> TranscriptResponse:
    """Assemble a :class:`TranscriptResponse` from raw segments + metadata."""
    segments = build_segments(raw_segments)
    if not segments:
        raise TranscriptUnavailableError("No transcript text could be produced for this video.")

    return TranscriptResponse(
        video_id=info.video_id,
        title=info.title,
        channel=info.channel,
        thumbnail=info.thumbnail,
        duration=info.duration,
        duration_seconds=info.duration_seconds,
        source=source,
        language=language,
        transcript=segments,
        text=segments_to_text(segments),
        cached=False,
    )
