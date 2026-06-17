"""Rate limiting via slowapi (in-memory token buckets keyed by client IP).

Decorator-based limiting is used on the routes (no global middleware), so each
endpoint opts into the limit that suits it. When ``rate_limit_enabled`` is False
the limiter becomes a no-op.
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.config import settings


def _client_key(request: Request) -> str:
    """Identify the client, honouring a reverse-proxy ``X-Forwarded-For``."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(
    key_func=_client_key,
    enabled=settings.rate_limit_enabled,
    storage_uri="memory://",
    headers_enabled=True,
)
