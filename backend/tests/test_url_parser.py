"""Tests for YouTube URL parsing/validation."""

from __future__ import annotations

import pytest

from app.exceptions import InvalidURLError
from app.utils.url_parser import extract_video_id, is_valid_video_id

VALID_ID = "dQw4w9WgXcQ"


@pytest.mark.parametrize(
    "url",
    [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "http://youtube.com/watch?v=dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ?t=42",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
        "https://www.youtube.com/live/dQw4w9WgXcQ",
        "www.youtube.com/watch?v=dQw4w9WgXcQ",
        "youtu.be/dQw4w9WgXcQ",
        "dQw4w9WgXcQ",  # bare id
    ],
)
def test_extract_video_id_valid(url: str) -> None:
    assert extract_video_id(url) == VALID_ID


@pytest.mark.parametrize(
    "url",
    [
        "",
        "   ",
        "https://example.com/watch?v=dQw4w9WgXcQ",
        "https://vimeo.com/123456",
        "https://www.youtube.com/watch?v=short",
        "not a url at all",
        "https://www.youtube.com/",
    ],
)
def test_extract_video_id_invalid(url: str) -> None:
    with pytest.raises(InvalidURLError):
        extract_video_id(url)


def test_is_valid_video_id() -> None:
    assert is_valid_video_id(VALID_ID)
    assert not is_valid_video_id("too-short")
    assert not is_valid_video_id("waytoolongtobevalid123")
