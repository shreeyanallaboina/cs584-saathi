"""Prototype confidence scoring from curated KB text (no external AI required)."""
from __future__ import annotations

import math
import re
from pathlib import Path

TOPICS = ("contraception", "abortion", "menstrual_health")

_STOP = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "both", "few",
    "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "just", "and", "but", "if",
    "or", "because", "until", "while", "about", "against", "between", "into",
    "through", "during", "i", "me", "my", "we", "our", "you", "your", "it",
    "its", "they", "them", "their", "what", "which", "who", "this", "that",
}


def _tokens(text: str) -> set[str]:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return {t for t in text.split() if len(t) > 2 and t not in _STOP}


def _matches_vocab(term: str, vocab: set[str]) -> bool:
    if term in vocab:
        return True
    if len(term) > 4 and term.endswith("s") and term[:-1] in vocab:
        return True
    if len(term) > 4 and term + "s" in vocab:
        return True
    return False


def _overlap_hits(query: set[str], vocab: set[str]) -> int:
    hits = 0
    for t in query:
        if _matches_vocab(t, vocab):
            hits += 1
    return hits


def _load_sections() -> dict[str, str]:
    path = Path(__file__).resolve().parent / "knowledge_base.txt"
    raw = path.read_text(encoding="utf-8")
    sections: dict[str, str] = {}
    current = None
    buf: list[str] = []
    for line in raw.splitlines():
        m = re.match(r"^##\s+(\w+)\s*$", line.strip())
        if m:
            if current:
                sections[current] = " ".join(buf).strip()
            current = m.group(1)
            buf = []
        elif current:
            if not line.startswith("#"):
                buf.append(line)
    if current:
        sections[current] = " ".join(buf).strip()
    return sections


_SECTIONS = _load_sections()


def score_query(user_text: str, topic: str | None) -> tuple[float, str | None, str | None]:
    """
    Returns (confidence 0..1, topic_key if matched section, answer_text or None).
    Confidence uses token overlap + topic alignment, scaled for prototype threshold 0.75.
    """
    q = _tokens(user_text)
    if not q:
        return 0.0, None, None

    best_conf = 0.0
    best_topic: str | None = None
    best_body: str | None = None

    topic_norm = (topic or "").lower().replace(" ", "_")
    if topic_norm == "menstrual":
        topic_norm = "menstrual_health"

    for key, body in _SECTIONS.items():
        if key not in TOPICS:
            continue
        b = _tokens(body)
        if not b:
            continue
        hits = _overlap_hits(q, b)
        recall = hits / max(len(q), 1)
        union = len(q | b) or 1
        jacc = hits / union
        topic_boost = 0.18 if topic_norm == key else 0.0
        density = hits / (math.sqrt(len(q)) * math.sqrt(min(len(b), 80)) + 1e-6)
        # Emphasize recall so plain-language questions still clear 0.75 when grounded
        conf = min(1.0, 0.42 * recall + 0.28 * min(1.0, jacc * 3) + 0.22 * min(1.0, density) + topic_boost)
        if hits >= 3:
            conf = max(conf, 0.82)
        if hits >= 2 and topic_norm == key:
            conf = max(conf, 0.78)
        if conf > best_conf:
            best_conf = conf
            best_topic = key
            best_body = body.strip()

    if best_conf < 0.75 or not best_body:
        return best_conf, best_topic, None

    # Short grounded reply: first 2 sentences of section + disclaimer
    sentences = re.split(r"(?<=[.!?])\s+", best_body)
    snippet = " ".join(sentences[:2]).strip()
    disclaimer = (
        " This information is for general education only and is not a substitute for care "
        "from a qualified health worker or doctor."
    )
    return best_conf, best_topic, snippet + disclaimer
