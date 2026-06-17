"""AI summary, key takeaways and (optional) translation.

If an OpenAI API key is configured, we use the Chat Completions API to produce a
high-quality summary, key takeaways and optional translation. Otherwise we fall
back to a lightweight, dependency-free *extractive* summary so the feature still
works (and tests don't require network access).
"""

from __future__ import annotations

import json
import re

from app.config import settings
from app.logging_config import get_logger
from app.models import SummaryResponse

logger = get_logger(__name__)

_MAX_CHARS = 48_000  # keep prompt well within model context


def generate_summary(text: str, target_language: str | None = None) -> SummaryResponse:
    """Return a summary + key takeaways for *text*.

    Uses OpenAI when available, otherwise an extractive fallback.
    """
    text = (text or "").strip()
    if not text:
        return SummaryResponse(
            summary="There is no transcript text to summarise.",
            takeaways=[],
            source="extractive",
            target_language=target_language,
        )

    if settings.summary_available:
        try:
            summary, takeaways = _openai_summary(text, target_language)
            return SummaryResponse(
                summary=summary,
                takeaways=takeaways,
                source="openai",
                target_language=target_language,
            )
        except Exception as exc:  # noqa: BLE001 - degrade gracefully
            logger.warning("OpenAI summary failed, using extractive fallback: %s", exc)

    summary, takeaways = _extractive_summary(text)
    return SummaryResponse(
        summary=summary,
        takeaways=takeaways,
        source="extractive",
        target_language=None,  # the fallback cannot translate
    )


# --------------------------------------------------------------------------- #
# OpenAI implementation
# --------------------------------------------------------------------------- #
def _openai_summary(text: str, target_language: str | None) -> tuple[str, list[str]]:
    from openai import OpenAI  # noqa: WPS433 - lazy import

    client = OpenAI(api_key=settings.openai_api_key)

    language_clause = (
        f" Write the summary and all takeaways in {target_language}."
        if target_language
        else ""
    )
    system = (
        "You are an expert at summarising video transcripts. Produce a concise, "
        "faithful summary and a list of key takeaways." + language_clause
    )
    user = (
        "Summarise the following video transcript. Respond with strict JSON of the "
        'form {"summary": string, "takeaways": string[]}. The summary should be 2-4 '
        "sentences. Provide 3-6 takeaways.\n\nTRANSCRIPT:\n" + text[:_MAX_CHARS]
    )

    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    content = completion.choices[0].message.content or "{}"
    data = json.loads(content)
    summary = str(data.get("summary", "")).strip()
    takeaways = [str(t).strip() for t in data.get("takeaways", []) if str(t).strip()]
    if not summary:
        raise ValueError("Empty summary from OpenAI")
    return summary, takeaways


# --------------------------------------------------------------------------- #
# Extractive fallback (no external dependencies)
# --------------------------------------------------------------------------- #
_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "while", "is", "are", "was", "were",
    "be", "been", "being", "to", "of", "in", "on", "for", "with", "as", "by", "at",
    "this", "that", "these", "those", "it", "its", "i", "you", "he", "she", "we",
    "they", "them", "his", "her", "their", "our", "your", "my", "me", "so", "then",
    "than", "too", "very", "can", "will", "just", "do", "does", "did", "have", "has",
    "had", "not", "no", "yes", "what", "which", "who", "when", "where", "how", "all",
    "would", "there", "about", "into", "out", "up", "down", "like", "get",
    "got", "go", "going", "really", "know", "think", "thing", "things", "kind", "lot",
}


def _split_sentences(text: str) -> list[str]:
    # Naive but effective sentence splitter.
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if len(p.strip()) > 0]


def _extractive_summary(text: str) -> tuple[str, list[str]]:
    """Score sentences by word frequency and return the top ones."""
    sentences = _split_sentences(text)
    if not sentences:
        return (text[:400].strip(), [])

    # Word frequency table (ignoring stopwords).
    words = re.findall(r"[a-zA-Z']+", text.lower())
    freq: dict[str, int] = {}
    for w in words:
        if w in _STOPWORDS or len(w) < 3:
            continue
        freq[w] = freq.get(w, 0) + 1

    if not freq:
        return (" ".join(sentences[:3]), sentences[:3])

    max_freq = max(freq.values())

    def score(sentence: str) -> float:
        tokens = re.findall(r"[a-zA-Z']+", sentence.lower())
        if not tokens:
            return 0.0
        s = sum(freq.get(t, 0) for t in tokens) / max_freq
        # Penalise very long/short sentences slightly.
        length_penalty = 1.0 if 6 <= len(tokens) <= 40 else 0.7
        return s * length_penalty

    indexed = list(enumerate(sentences))
    ranked = sorted(indexed, key=lambda pair: score(pair[1]), reverse=True)

    top_summary = sorted(ranked[: min(3, len(ranked))], key=lambda pair: pair[0])
    summary = " ".join(s for _, s in top_summary)

    top_takeaways = sorted(ranked[: min(5, len(ranked))], key=lambda pair: pair[0])
    takeaways = [s for _, s in top_takeaways]

    return summary, takeaways
