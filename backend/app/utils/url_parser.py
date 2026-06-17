"""Parse and validate YouTube URLs and extract the 11-character video ID.

Supports every common YouTube URL shape:
    - https://www.youtube.com/watch?v=VIDEOID
    - https://youtu.be/VIDEOID
    - https://www.youtube.com/embed/VIDEOID
    - https://www.youtube.com/shorts/VIDEOID
    - https://www.youtube.com/live/VIDEOID
    - https://m.youtube.com/watch?v=VIDEOID
    - https://music.youtube.com/watch?v=VIDEOID
    - A bare 11-character video ID
"""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

from app.exceptions import InvalidURLError

# A YouTube video ID is exactly 11 chars of [A-Za-z0-9_-].
_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

_ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
}

# Path prefixes that are immediately followed by the video ID.
_PATH_PREFIXES = ("/embed/", "/shorts/", "/live/", "/v/")


def is_valid_video_id(value: str) -> bool:
    """Return True if *value* looks like a bare YouTube video ID."""
    return bool(_VIDEO_ID_RE.match(value))


def extract_video_id(url: str) -> str:
    """Extract and return the YouTube video ID from *url*.

    Raises:
        InvalidURLError: if no valid video ID can be extracted.
    """
    if not url or not isinstance(url, str):
        raise InvalidURLError("No URL was provided.")

    candidate = url.strip()

    # Allow a bare video ID to be passed directly.
    if is_valid_video_id(candidate):
        return candidate

    # Make sure urlparse can find a host even when the scheme is missing.
    if "://" not in candidate:
        candidate = "https://" + candidate

    try:
        parsed = urlparse(candidate)
    except ValueError as exc:  # pragma: no cover - urlparse rarely raises
        raise InvalidURLError("The URL could not be parsed.") from exc

    host = (parsed.hostname or "").lower()
    if host not in _ALLOWED_HOSTS:
        raise InvalidURLError("That does not look like a YouTube URL.")

    # youtu.be/VIDEOID  -> the path is the id
    if host in {"youtu.be", "www.youtu.be"}:
        vid = parsed.path.lstrip("/").split("/")[0]
        if is_valid_video_id(vid):
            return vid
        raise InvalidURLError("Could not find a valid video ID in the short URL.")

    # /watch?v=VIDEOID
    if parsed.path in {"/watch", "/watch/"}:
        query = parse_qs(parsed.query)
        values = query.get("v", [])
        if values and is_valid_video_id(values[0]):
            return values[0]
        raise InvalidURLError("Could not find a 'v' parameter with a valid video ID.")

    # /embed/VIDEOID, /shorts/VIDEOID, /live/VIDEOID, /v/VIDEOID
    for prefix in _PATH_PREFIXES:
        if parsed.path.startswith(prefix):
            vid = parsed.path[len(prefix):].split("/")[0]
            if is_valid_video_id(vid):
                return vid
            raise InvalidURLError("Could not find a valid video ID in the URL path.")

    # Sometimes the id still lives in the query string (e.g. ?v=...).
    query = parse_qs(parsed.query)
    if "v" in query and query["v"] and is_valid_video_id(query["v"][0]):
        return query["v"][0]

    raise InvalidURLError("Could not extract a video ID from the URL.")


def canonical_url(video_id: str) -> str:
    """Return the canonical watch URL for a video ID."""
    return f"https://www.youtube.com/watch?v={video_id}"
