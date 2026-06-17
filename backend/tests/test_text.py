"""Tests for text utilities."""

from __future__ import annotations

from app.utils.text import build_segments, format_duration, segments_to_text


def test_format_duration() -> None:
    assert format_duration(0) == "0:00"
    assert format_duration(5) == "0:05"
    assert format_duration(65) == "1:05"
    assert format_duration(3661) == "1:01:01"
    assert format_duration(None) == "0:00"
    assert format_duration(-10) == "0:00"


def test_build_segments_and_text() -> None:
    raw = [
        {"text": "Hello   world", "start": 0.0, "duration": 2.0},
        {"text": "", "start": 2.0, "duration": 1.0},  # skipped (empty)
        {"text": "second\nline", "start": 2.5, "duration": 3.0},
    ]
    segments = build_segments(raw)
    assert len(segments) == 2
    assert segments[0].text == "Hello world"
    assert segments[0].end == 2.0
    assert segments[1].text == "second line"
    assert segments[1].end == 5.5

    text = segments_to_text(segments)
    assert text == "Hello world second line"
