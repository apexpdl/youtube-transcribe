"""In-memory background job manager for transcription.

Why a job manager?
    - Whisper on a long video can take minutes; we don't want to hold an HTTP
      request open. The client creates a job, then polls for progress.
    - It lets us de-duplicate concurrent requests for the same video so we never
      process the same video twice at once ("prevent duplicate processing").

This is intentionally lightweight (a thread pool + a dict). For a multi-replica
deployment you'd swap this for Redis/Celery, but the interface would stay the
same.
"""

from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from app.config import settings
from app.exceptions import TubeTranscriptError
from app.logging_config import get_logger
from app.models import JobState, JobStatus
from app.services.transcript_service import get_transcript
from app.utils.url_parser import extract_video_id

logger = get_logger(__name__)


class JobManager:
    """Manages async transcription jobs with de-duplication and TTL cleanup."""

    def __init__(self) -> None:
        self._jobs: dict[str, JobState] = {}
        self._dedup: dict[str, str] = {}  # dedup-key -> job_id
        self._lock = threading.RLock()
        self._executor = ThreadPoolExecutor(
            max_workers=max(1, settings.max_concurrent_jobs),
            thread_name_prefix="transcribe",
        )

    # ------------------------------------------------------------------ #
    @staticmethod
    def _dedup_key(video_id: str, force_whisper: bool, language: str | None) -> str:
        return f"{video_id}:{'w' if force_whisper else 'a'}:{language or 'def'}"

    def _update(self, job_id: str, **changes) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            data = job.model_dump()
            data.update(changes)
            data["updated_at"] = time.time()
            self._jobs[job_id] = JobState(**data)

    def _make_progress(self, job_id: str):
        """Return a progress callback bound to *job_id*."""

        def _progress(fraction: float, message: str) -> None:
            status = JobStatus.processing
            lowered = message.lower()
            if "download" in lowered:
                status = JobStatus.downloading
            elif "transcri" in lowered or "whisper" in lowered or "ai " in lowered:
                status = JobStatus.transcribing
            self._update(
                job_id,
                progress=max(0.0, min(float(fraction), 1.0)),
                message=message,
                status=status,
            )

        return _progress

    # ------------------------------------------------------------------ #
    def create_job(
        self, url: str, *, language: str | None = None, force_whisper: bool = False
    ) -> JobState:
        """Create (or reuse) a job and schedule it. Returns the job state."""
        self._cleanup_expired()

        # Validate up-front so obviously bad URLs fail fast (raises InvalidURLError).
        video_id = extract_video_id(url)
        dedup_key = self._dedup_key(video_id, force_whisper, language)

        with self._lock:
            # De-duplicate: reuse an in-flight job for the same request.
            existing_id = self._dedup.get(dedup_key)
            if existing_id and existing_id in self._jobs:
                existing = self._jobs[existing_id]
                if existing.status not in {JobStatus.completed, JobStatus.failed}:
                    logger.info("Reusing in-flight job %s for %s", existing_id, video_id)
                    return existing

            job_id = uuid.uuid4().hex
            job = JobState(
                job_id=job_id,
                status=JobStatus.queued,
                progress=0.0,
                message="Queued…",
            )
            self._jobs[job_id] = job
            self._dedup[dedup_key] = job_id

        self._executor.submit(
            self._run, job_id, url, language, force_whisper, dedup_key
        )
        return self._jobs[job_id]

    def _run(
        self,
        job_id: str,
        url: str,
        language: str | None,
        force_whisper: bool,
        dedup_key: str,
    ) -> None:
        """Worker body executed in the thread pool."""
        self._update(job_id, status=JobStatus.processing, message="Starting…", progress=0.01)
        try:
            result = get_transcript(
                url,
                language=language,
                force_whisper=force_whisper,
                progress=self._make_progress(job_id),
            )
            self._update(
                job_id,
                status=JobStatus.completed,
                progress=1.0,
                message="Completed.",
                result=result,
            )
        except TubeTranscriptError as exc:
            logger.info("Job %s failed: %s", job_id, exc.message)
            self._update(
                job_id, status=JobStatus.failed, message=exc.message, error=exc.message
            )
        except Exception as exc:  # noqa: BLE001 - never crash the worker
            logger.exception("Job %s crashed", job_id)
            self._update(
                job_id,
                status=JobStatus.failed,
                message="An unexpected error occurred.",
                error=str(exc),
            )
        finally:
            with self._lock:
                # Release the dedup slot once finished.
                if self._dedup.get(dedup_key) == job_id:
                    self._dedup.pop(dedup_key, None)

    # ------------------------------------------------------------------ #
    def get_job(self, job_id: str) -> JobState | None:
        with self._lock:
            return self._jobs.get(job_id)

    def _cleanup_expired(self) -> None:
        """Drop finished jobs older than the configured TTL."""
        now = time.time()
        ttl = settings.job_ttl_seconds
        with self._lock:
            stale = [
                jid
                for jid, job in self._jobs.items()
                if job.status in {JobStatus.completed, JobStatus.failed}
                and now - job.updated_at > ttl
            ]
            for jid in stale:
                self._jobs.pop(jid, None)

    def shutdown(self) -> None:  # pragma: no cover - lifecycle
        self._executor.shutdown(wait=False, cancel_futures=True)


# Module-level singleton.
job_manager = JobManager()
