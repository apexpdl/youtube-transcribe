"""A small thread-safe, TTL'd transcript cache.

Two layers:
    1. An in-process LRU-ish dict for hot reads.
    2. A JSON file on disk so results survive restarts.

Caching avoids re-downloading audio / re-running Whisper for the same video and
satisfies the "prevent duplicate processing" requirement together with the job
de-duplication in ``jobs.py``.
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

from app.config import settings
from app.logging_config import get_logger
from app.models import TranscriptResponse
from app.utils.files import ensure_dir

logger = get_logger(__name__)


class TranscriptCache:
    """Disk + memory cache keyed by ``"{video_id}:{source_pref}"``."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._memory: dict[str, tuple[float, TranscriptResponse]] = {}
        self._dir = ensure_dir(settings.cache_dir)

    # ------------------------------------------------------------------ #
    @staticmethod
    def _make_key(video_id: str, force_whisper: bool, language: str | None) -> str:
        pref = "whisper" if force_whisper else "auto"
        lang = language or "default"
        return f"{video_id}:{pref}:{lang}"

    def _path_for(self, key: str) -> Path:
        safe = key.replace(":", "__").replace("/", "_")
        return self._dir / f"{safe}.json"

    # ------------------------------------------------------------------ #
    def get(
        self, video_id: str, *, force_whisper: bool = False, language: str | None = None
    ) -> TranscriptResponse | None:
        """Return a cached transcript or ``None`` (respecting the TTL)."""
        if not settings.cache_enabled:
            return None

        key = self._make_key(video_id, force_whisper, language)
        now = time.time()

        with self._lock:
            cached = self._memory.get(key)
            if cached and now - cached[0] < settings.cache_ttl_seconds:
                logger.info("Cache hit (memory) for %s", key)
                return cached[1].model_copy(update={"cached": True})

            path = self._path_for(key)
            if path.exists():
                try:
                    payload = json.loads(path.read_text(encoding="utf-8"))
                    stored_at = float(payload.get("_cached_at", 0))
                    if now - stored_at < settings.cache_ttl_seconds:
                        response = TranscriptResponse.model_validate(payload["data"])
                        self._memory[key] = (stored_at, response)
                        logger.info("Cache hit (disk) for %s", key)
                        return response.model_copy(update={"cached": True})
                    # expired
                    path.unlink(missing_ok=True)
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("Failed to read cache file %s: %s", path, exc)
                    path.unlink(missing_ok=True)
        return None

    def set(
        self,
        response: TranscriptResponse,
        *,
        force_whisper: bool = False,
        language: str | None = None,
    ) -> None:
        """Persist *response* to memory and disk."""
        if not settings.cache_enabled:
            return

        key = self._make_key(response.video_id, force_whisper, language)
        now = time.time()
        with self._lock:
            self._memory[key] = (now, response)
            try:
                payload = {"_cached_at": now, "data": response.model_dump(mode="json")}
                self._path_for(key).write_text(
                    json.dumps(payload, ensure_ascii=False), encoding="utf-8"
                )
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Failed to write cache for %s: %s", key, exc)

    def clear(self) -> None:
        """Wipe both cache layers (used by tests)."""
        with self._lock:
            self._memory.clear()
            for file in self._dir.glob("*.json"):
                file.unlink(missing_ok=True)


# Module-level singleton.
transcript_cache = TranscriptCache()
