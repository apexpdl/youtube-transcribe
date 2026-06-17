"""yt-dlp wrapper: fetch video metadata and download audio.

Used for:
    - The "Video Information" card (title, channel, thumbnail, duration).
    - Downloading audio when we need to fall back to Whisper.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from app.config import settings
from app.exceptions import (
    AudioDownloadError,
    NetworkError,
    PrivateVideoError,
    RegionBlockedError,
    VideoNotFoundError,
    VideoUnavailableError,
)
from app.logging_config import get_logger
from app.models import VideoInfo
from app.utils.text import format_duration
from app.utils.url_parser import canonical_url

logger = get_logger(__name__)


def _base_ydl_opts() -> dict:
    """Common yt-dlp options shared by metadata + download calls."""
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "skip_download": True,
        "youtube_include_dash_manifest": False,
        # Be a good citizen / reduce throttling.
        "retries": 3,
        "socket_timeout": 30,
    }
    if settings.ytdlp_proxy:
        opts["proxy"] = settings.ytdlp_proxy
    if settings.ytdlp_cookiefile:
        opts["cookiefile"] = settings.ytdlp_cookiefile
    return opts


def _map_ytdlp_error(exc: Exception) -> Exception:
    """Translate a yt-dlp error message into a domain exception."""
    msg = str(exc).lower()
    if "private" in msg:
        return PrivateVideoError("This video is private.")
    if "not available in your country" in msg or "geo" in msg or "region" in msg:
        return RegionBlockedError("This video is not available in the server's region.")
    if "removed" in msg or "no longer available" in msg or "terminated" in msg:
        return VideoNotFoundError("This video has been removed or no longer exists.")
    if "unavailable" in msg or "members-only" in msg or "sign in" in msg or "age" in msg:
        return VideoUnavailableError(
            "This video is unavailable (it may be age-restricted, members-only, or login-required)."
        )
    if "not exist" in msg or "incorrect" in msg or "invalid" in msg:
        return VideoNotFoundError("This video could not be found.")
    if "timed out" in msg or "connection" in msg or "network" in msg or "resolve" in msg:
        return NetworkError("Network error while contacting YouTube. Please try again.")
    return AudioDownloadError("Failed to process the video with yt-dlp.")


def get_video_info(video_id: str) -> VideoInfo:
    """Return metadata for *video_id* using yt-dlp (no download)."""
    try:
        import yt_dlp  # noqa: WPS433 - lazy import keeps startup fast
    except ImportError as exc:  # pragma: no cover
        raise AudioDownloadError("yt-dlp is not installed on the server.") from exc

    url = canonical_url(video_id)
    try:
        with yt_dlp.YoutubeDL(_base_ydl_opts()) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:  # noqa: BLE001
        logger.info("yt-dlp metadata error for %s: %s", video_id, exc)
        raise _map_ytdlp_error(exc) from exc

    if info is None:
        raise VideoNotFoundError("This video could not be found.")

    duration_seconds = int(info.get("duration") or 0)
    thumbnail = info.get("thumbnail") or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

    return VideoInfo(
        video_id=video_id,
        title=info.get("title") or "Untitled video",
        channel=info.get("uploader") or info.get("channel") or "Unknown channel",
        thumbnail=thumbnail,
        duration=format_duration(duration_seconds),
        duration_seconds=duration_seconds,
        url=url,
    )


def download_audio(
    video_id: str,
    workdir: Path,
    progress_hook: Callable[[float, str], None] | None = None,
) -> Path:
    """Download the best audio track for *video_id* into *workdir*.

    Args:
        video_id: YouTube video ID.
        workdir: Directory to download into (caller is responsible for cleanup).
        progress_hook: Optional callable ``(fraction, message)`` for progress.

    Returns:
        Path to the downloaded audio file.

    Raises:
        AudioDownloadError / VideoUnavailableError / NetworkError / ...
    """
    try:
        import yt_dlp  # noqa: WPS433
    except ImportError as exc:  # pragma: no cover
        raise AudioDownloadError("yt-dlp is not installed on the server.") from exc

    url = canonical_url(video_id)
    out_template = str(workdir / "%(id)s.%(ext)s")

    def _hook(d: dict) -> None:
        if progress_hook is None:
            return
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes") or 0
            frac = (downloaded / total) if total else 0.0
            progress_hook(min(frac, 0.99), "Downloading audio…")
        elif status == "finished":
            progress_hook(1.0, "Audio downloaded. Preparing transcription…")

    opts = _base_ydl_opts()
    opts.update(
        {
            "skip_download": False,
            "format": settings.ytdlp_format,
            "outtmpl": out_template,
            "progress_hooks": [_hook],
            # Convert to a Whisper-friendly format if ffmpeg is available.
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "128",
                }
            ],
        }
    )
    if settings.max_download_mb and settings.max_download_mb > 0:
        opts["max_filesize"] = settings.max_download_mb * 1024 * 1024

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
    except Exception as exc:  # noqa: BLE001
        logger.info("yt-dlp download error for %s: %s", video_id, exc)
        raise _map_ytdlp_error(exc) from exc

    # Find the produced audio file (post-processing may have changed extension).
    audio_exts = {".mp3", ".m4a", ".webm", ".wav", ".opus", ".ogg"}
    candidates = sorted(workdir.glob(f"{video_id}.*"))
    audio_files = [p for p in candidates if p.suffix.lower() in audio_exts]
    if not audio_files:
        audio_files = candidates  # fall back to anything we downloaded
    if not audio_files:
        raise AudioDownloadError("Audio download produced no output file.")

    return audio_files[0]
