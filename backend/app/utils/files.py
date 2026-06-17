"""Temp-file helpers with guaranteed cleanup."""

from __future__ import annotations

import contextlib
import os
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)


def ensure_dir(path: str | os.PathLike[str]) -> Path:
    """Create *path* (and parents) if needed and return it as a ``Path``."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


@contextlib.contextmanager
def temp_workdir(prefix: str = "tt-") -> Iterator[Path]:
    """Yield a temporary working directory, removing it on exit.

    Respects ``settings.cleanup_files`` — when False the directory is kept so it
    can be inspected during debugging.
    """
    base = ensure_dir(settings.temp_dir)
    path = Path(tempfile.mkdtemp(prefix=prefix, dir=str(base)))
    try:
        yield path
    finally:
        if settings.cleanup_files:
            safe_rmtree(path)
        else:  # pragma: no cover - debugging aid only
            logger.debug("Keeping temp dir (cleanup disabled): %s", path)


def safe_rmtree(path: str | os.PathLike[str]) -> None:
    """Recursively delete *path*, swallowing errors."""
    try:
        shutil.rmtree(path, ignore_errors=True)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Failed to remove temp dir %s: %s", path, exc)
