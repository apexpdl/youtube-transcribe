"""Text helpers: timestamp formatting, transcript flattening, paragraphing."""

from __future__ import annotations

from app.models import TranscriptSegment


def format_duration(seconds: float | int | None) -> str:
    """Format a number of seconds as ``H:MM:SS`` or ``M:SS``."""
    if seconds is None:
        return "0:00"
    total = int(round(float(seconds)))
    if total < 0:
        total = 0
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def clean_text(value: str) -> str:
    """Collapse whitespace/newlines that captions sometimes contain."""
    return " ".join(value.replace("\n", " ").split()).strip()


def segments_to_text(segments: list[TranscriptSegment]) -> str:
    """Join segment texts into a single readable plain-text blob."""
    return " ".join(clean_text(seg.text) for seg in segments if seg.text).strip()


def build_segments(raw: list[dict]) -> list[TranscriptSegment]:
    """Normalise a list of ``{text, start, duration}`` dicts into segments."""
    segments: list[TranscriptSegment] = []
    for item in raw:
        text = clean_text(str(item.get("text", "")))
        if not text:
            continue
        start = float(item.get("start", 0.0) or 0.0)
        duration = float(item.get("duration", 0.0) or 0.0)
        segments.append(
            TranscriptSegment(
                text=text,
                start=round(start, 3),
                duration=round(duration, 3),
                end=round(start + duration, 3),
            )
        )
    return segments
