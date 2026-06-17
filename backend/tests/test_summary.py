"""Tests for the extractive summary fallback (no network required)."""

from __future__ import annotations

from app.services.summary import generate_summary


def test_extractive_summary_returns_content() -> None:
    text = (
        "Python is a popular programming language. "
        "Python is widely used for data science and machine learning. "
        "Many developers love Python because it is easy to read. "
        "The language has a large ecosystem of libraries. "
        "Machine learning libraries like scikit-learn are written for Python."
    )
    result = generate_summary(text)
    assert result.source == "extractive"
    assert isinstance(result.summary, str) and len(result.summary) > 0
    assert len(result.takeaways) > 0


def test_empty_text() -> None:
    result = generate_summary("")
    assert result.takeaways == []
    assert "no transcript" in result.summary.lower()
