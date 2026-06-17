"""Local OpenAI Whisper transcription (the captions fallback).

The model is heavy to load, so it is loaded lazily and cached for the lifetime
of the process. Whisper requires ``ffmpeg`` to be installed on the system.
"""

from __future__ import annotations

import threading
from collections.abc import Callable
from pathlib import Path

from app.config import settings
from app.exceptions import WhisperFailedError, WhisperUnavailableError
from app.logging_config import get_logger

logger = get_logger(__name__)

_model = None
_model_lock = threading.Lock()


def _resolve_device() -> str:
    """Pick a torch device based on configuration and availability."""
    configured = (settings.whisper_device or "auto").lower()
    if configured in {"cpu", "cuda"}:
        return configured
    try:
        import torch  # noqa: WPS433

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:  # noqa: BLE001
        return "cpu"


def _load_model():
    """Load (and memoise) the Whisper model. Thread-safe."""
    global _model
    if _model is not None:
        return _model

    with _model_lock:
        if _model is not None:  # double-checked locking
            return _model
        try:
            import whisper  # noqa: WPS433
        except ImportError as exc:
            raise WhisperUnavailableError(
                "Whisper is not installed on the server. Install 'openai-whisper'."
            ) from exc

        device = _resolve_device()
        logger.info("Loading Whisper model '%s' on %s…", settings.whisper_model, device)
        try:
            _model = whisper.load_model(settings.whisper_model, device=device)
        except Exception as exc:  # noqa: BLE001
            raise WhisperFailedError(f"Failed to load the Whisper model: {exc}") from exc
        logger.info("Whisper model loaded.")
        return _model


def is_available() -> bool:
    """Return True if Whisper can be used (enabled + importable)."""
    if not settings.whisper_enabled:
        return False
    try:
        import whisper  # noqa: F401,WPS433

        return True
    except Exception:  # noqa: BLE001
        return False


def transcribe(
    audio_path: Path,
    language: str | None = None,
    progress_hook: Callable[[float, str], None] | None = None,
) -> list[dict]:
    """Transcribe *audio_path* and return ``{text, start, duration}`` dicts.

    Raises:
        WhisperUnavailableError: Whisper disabled / not installed.
        WhisperFailedError: transcription failed.
    """
    if not settings.whisper_enabled:
        raise WhisperUnavailableError("Whisper transcription is disabled on this server.")

    model = _load_model()

    if progress_hook:
        progress_hook(0.05, "Starting AI transcription (Whisper)…")

    lang = language or settings.whisper_compute_language
    try:
        # fp16 only makes sense on CUDA.
        use_fp16 = _resolve_device() == "cuda"
        result = model.transcribe(
            str(audio_path),
            language=lang,
            fp16=use_fp16,
            verbose=False,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Whisper transcription failed for %s", audio_path)
        raise WhisperFailedError(f"AI transcription failed: {exc}") from exc

    if progress_hook:
        progress_hook(0.98, "Finalising transcript…")

    segments = result.get("segments") or []
    out: list[dict] = []
    for seg in segments:
        start = float(seg.get("start", 0.0) or 0.0)
        end = float(seg.get("end", start) or start)
        out.append(
            {
                "text": str(seg.get("text", "")).strip(),
                "start": start,
                "duration": max(end - start, 0.0),
            }
        )

    # If the model returned no segments but did return text, wrap it.
    if not out and result.get("text"):
        out.append({"text": str(result["text"]).strip(), "start": 0.0, "duration": 0.0})

    if not out:
        raise WhisperFailedError("AI transcription produced no text.")

    return out


def detected_language(result_language: str | None, fallback: str | None) -> str | None:
    """Small helper to choose the most specific language code available."""
    return result_language or fallback
