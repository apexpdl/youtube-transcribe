"""Domain-specific exceptions and their HTTP status mapping.

Each exception carries a stable ``code`` (machine readable) and a human readable
message so the frontend can present helpful errors to the user.
"""

from __future__ import annotations


class TubeTranscriptError(Exception):
    """Base class for all application errors.

    Attributes:
        message: Human readable error message (safe to show users).
        code: Stable machine-readable error code.
        status_code: HTTP status code to return.
    """

    status_code: int = 400
    code: str = "error"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


class InvalidURLError(TubeTranscriptError):
    """The supplied string is not a valid YouTube URL."""

    status_code = 400
    code = "invalid_url"


class VideoNotFoundError(TubeTranscriptError):
    """The video was removed, never existed, or the ID is wrong."""

    status_code = 404
    code = "video_not_found"


class VideoUnavailableError(TubeTranscriptError):
    """The video exists but cannot be accessed (private/removed/region locked)."""

    status_code = 403
    code = "video_unavailable"


class PrivateVideoError(VideoUnavailableError):
    """The video is private."""

    code = "private_video"


class RegionBlockedError(VideoUnavailableError):
    """The video is blocked in the server's region."""

    code = "region_blocked"


class CaptionsUnavailableError(TubeTranscriptError):
    """No usable captions are available for the video."""

    status_code = 404
    code = "captions_unavailable"


class WhisperUnavailableError(TubeTranscriptError):
    """Whisper is disabled or not installed on the server."""

    status_code = 503
    code = "whisper_unavailable"


class WhisperFailedError(TubeTranscriptError):
    """Whisper transcription failed."""

    status_code = 500
    code = "whisper_failed"


class AudioDownloadError(TubeTranscriptError):
    """yt-dlp failed to download the audio."""

    status_code = 502
    code = "audio_download_failed"


class VideoTooLongError(TubeTranscriptError):
    """The video exceeds the configured Whisper duration cap."""

    status_code = 413
    code = "video_too_long"


class TranscriptUnavailableError(TubeTranscriptError):
    """Neither captions nor Whisper could produce a transcript."""

    status_code = 422
    code = "transcript_unavailable"


class SummaryUnavailableError(TubeTranscriptError):
    """AI summary cannot be produced (no API key / disabled)."""

    status_code = 503
    code = "summary_unavailable"


class NetworkError(TubeTranscriptError):
    """A network-level failure talking to YouTube."""

    status_code = 502
    code = "network_error"
