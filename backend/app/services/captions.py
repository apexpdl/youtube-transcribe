"""Retrieve existing YouTube captions via ``youtube-transcript-api``.

This module is written defensively so it works across both the legacy static
API (``YouTubeTranscriptApi.list_transcripts`` / ``.get_transcript`` in 0.6.x)
and the newer instance API (``YouTubeTranscriptApi().list`` / ``.fetch`` in
1.x). It always returns a normalised list of ``{text, start, duration}`` dicts.
"""

from __future__ import annotations

from app.exceptions import (
    CaptionsUnavailableError,
    NetworkError,
    PrivateVideoError,
    RegionBlockedError,
    VideoNotFoundError,
    VideoUnavailableError,
)
from app.logging_config import get_logger

logger = get_logger(__name__)

# Preferred languages, in priority order, when the caller doesn't specify one.
_DEFAULT_LANGS = ["en", "en-US", "en-GB"]

# Transcript-finder method names to try, in priority order (manual > generated > any).
_FINDERS = (
    "find_manually_created_transcript",
    "find_generated_transcript",
    "find_transcript",
)


def _normalise(raw_items) -> list[dict]:
    """Convert API items (dicts or snippet objects) into plain dicts."""
    out: list[dict] = []
    for item in raw_items:
        if isinstance(item, dict):
            text = item.get("text", "")
            start = item.get("start", 0.0)
            duration = item.get("duration", 0.0)
        else:  # FetchedTranscriptSnippet (1.x)
            text = getattr(item, "text", "")
            start = getattr(item, "start", 0.0)
            duration = getattr(item, "duration", 0.0)
        out.append(
            {
                "text": str(text),
                "start": float(start or 0.0),
                "duration": float(duration or 0.0),
            }
        )
    return out


def _candidate_languages(language: str | None) -> list[str]:
    if language:
        # Try the exact code first, then fall back to the defaults.
        return [language, *[lng for lng in _DEFAULT_LANGS if lng != language]]
    return list(_DEFAULT_LANGS)


def _map_known_errors(exc: Exception) -> Exception | None:
    """Translate a library exception into a domain exception, or None if unknown."""
    name = type(exc).__name__
    lowered = str(exc).lower()

    if name in {"TranscriptsDisabled", "NoTranscriptFound", "NoTranscriptAvailable"}:
        return CaptionsUnavailableError(
            "This video does not have captions available.", code="captions_unavailable"
        )
    if name in {"VideoUnavailable", "VideoUnplayable"}:
        return VideoUnavailableError("This video is unavailable.")
    if "private" in lowered:
        return PrivateVideoError("This video is private.")
    if "region" in lowered or "country" in lowered:
        return RegionBlockedError("This video is not available in the server's region.")
    if "not exist" in lowered or "unavailable" in lowered:
        return VideoNotFoundError("This video could not be found or has been removed.")
    if "too many requests" in lowered or ("ip" in lowered and "block" in lowered):
        return NetworkError("YouTube is rate-limiting requests from this server. Try again later.")
    return None


def fetch_captions(
    video_id: str, language: str | None = None
) -> tuple[list[dict], str | None]:
    """Fetch the best available captions for *video_id*.

    Returns a tuple of ``(segments, language_code)``.

    Raises:
        CaptionsUnavailableError: when no captions exist / are disabled.
        VideoUnavailableError, PrivateVideoError, RegionBlockedError, etc.
    """
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError as exc:  # pragma: no cover - dependency missing
        raise CaptionsUnavailableError(
            "Caption support is not installed on the server."
        ) from exc

    languages = _candidate_languages(language)

    try:
        # ---- Legacy static API (youtube-transcript-api 0.6.x) ----
        if hasattr(YouTubeTranscriptApi, "list_transcripts"):
            return _fetch_legacy(YouTubeTranscriptApi, video_id, languages)
        # ---- New instance API (youtube-transcript-api 1.x) ----
        return _fetch_modern(YouTubeTranscriptApi, video_id, languages)
    except (
        CaptionsUnavailableError,
        VideoUnavailableError,
        VideoNotFoundError,
        PrivateVideoError,
        RegionBlockedError,
        NetworkError,
    ):
        raise
    except Exception as exc:  # noqa: BLE001 - translate everything else
        mapped = _map_known_errors(exc)
        if mapped is not None:
            raise mapped from exc
        logger.warning("Unexpected caption error for %s: %s", video_id, exc)
        raise CaptionsUnavailableError(
            "Captions could not be retrieved for this video."
        ) from exc


def _fetch_legacy(api, video_id: str, languages: list[str]) -> tuple[list[dict], str | None]:
    """Caption fetch path for youtube-transcript-api 0.6.x."""
    transcript_list = api.list_transcripts(video_id)

    # 1) Try a manually-created transcript in a preferred language.
    # 2) Fall back to an auto-generated one.
    # 3) Finally take whatever exists (and translate to English if possible).
    transcript = None
    for finder in _FINDERS:
        try:
            transcript = getattr(transcript_list, finder)(languages)
            if transcript is not None:
                break
        except Exception:  # noqa: BLE001 - keep trying other strategies
            transcript = None

    if transcript is None:
        # Take the first available transcript of any language.
        available = list(transcript_list)
        if not available:
            raise CaptionsUnavailableError("This video does not have captions available.")
        transcript = available[0]
        if getattr(transcript, "is_translatable", False):
            try:
                transcript = transcript.translate("en")
            except Exception:  # noqa: BLE001
                pass

    data = _normalise(transcript.fetch())
    lang_code = getattr(transcript, "language_code", None)
    if not data:
        raise CaptionsUnavailableError("The captions for this video are empty.")
    return data, lang_code


def _fetch_modern(api_cls, video_id: str, languages: list[str]) -> tuple[list[dict], str | None]:
    """Caption fetch path for youtube-transcript-api 1.x."""
    api = api_cls()

    # Try a direct fetch in preferred languages first.
    try:
        fetched = api.fetch(video_id, languages=languages)
        data = _normalise(fetched)
        lang_code = getattr(fetched, "language_code", None)
        if data:
            return data, lang_code
    except Exception:  # noqa: BLE001 - fall through to listing
        pass

    # Otherwise enumerate available transcripts and translate if needed.
    transcript_list = api.list(video_id)
    transcript = None
    for finder in _FINDERS:
        if hasattr(transcript_list, finder):
            try:
                transcript = getattr(transcript_list, finder)(languages)
                if transcript is not None:
                    break
            except Exception:  # noqa: BLE001
                transcript = None

    if transcript is None:
        available = list(transcript_list)
        if not available:
            raise CaptionsUnavailableError("This video does not have captions available.")
        transcript = available[0]
        if getattr(transcript, "is_translatable", False):
            try:
                transcript = transcript.translate("en")
            except Exception:  # noqa: BLE001
                pass

    data = _normalise(transcript.fetch())
    lang_code = getattr(transcript, "language_code", None)
    if not data:
        raise CaptionsUnavailableError("The captions for this video are empty.")
    return data, lang_code
