"""Grounded LLM chat: knowledge base in system prompt + JSON output; 75% enforced in chat_service."""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

VALID_TOPICS = frozenset({"contraception", "abortion", "menstrual_health"})


def load_knowledge_base_text() -> str:
    path = Path(__file__).resolve().parent / "knowledge_base.txt"
    return path.read_text(encoding="utf-8").strip()


def gemini_api_key() -> str | None:
    """Google AI Studio / Gemini keys: prefer GEMINI_API_KEY, also accept GOOGLE_API_KEY."""
    return (
        os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("GOOGLE_API_KEY", "").strip()
        or None
    )


def _strip_code_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


def _build_system_prompt(kb_text: str) -> str:
    return f"""You are Saathi, a reproductive health information assistant for women in rural Pakistan.
You must answer ONLY from the KNOWLEDGE BASE below. Do not add facts, medicines, doses, legal conclusions, or diagnoses that are not clearly supported by the knowledge base.
Stay within these topics only: contraception, abortion (only as described in the base — general education and when to seek care), and menstrual health.
If the question is outside this scope, or the knowledge base does not contain enough information for a safe accurate answer, you MUST set "answer" to null, "can_answer" to false, and "confidence" below 0.75.
The "confidence" field must be your honest estimate from 0.0 to 1.0 of how fully the KNOWLEDGE BASE supports your specific answer (not how fluent the answer sounds).
"matched_topic" must be one of: contraception, abortion, menstrual_health, or null if none applies.

Respond with a single JSON object only (no markdown), with exactly these keys:
- "confidence": number
- "can_answer": boolean
- "answer": string or null (plain language, short paragraphs OK; if not null, only KB-grounded content)
- "matched_topic": string or null

KNOWLEDGE BASE:
---
{kb_text}
---
"""


def complete_llm(user_message: str, topic: str | None, kb_text: str) -> dict:
    api_key = gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY is not set")

    try:
        from google import genai
    except ImportError as e:
        raise RuntimeError("google-genai package is not installed") from e

    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash-lite").strip()
    topic_norm = (topic or "").strip() or "none"

    system = _build_system_prompt(kb_text)
    user = f'Topic hint from user (may be "none"): {topic_norm}\n\nQuestion:\n{user_message}'

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=user,
        config={
            "system_instruction": system,
            "temperature": 0.2,
            "response_mime_type": "application/json",
        },
    )

    try:
        raw = response.text or "{}"
    except ValueError as e:
        logger.warning("Gemini response blocked or empty: %s", response)
        raise RuntimeError("Gemini returned no usable text (safety filter or empty response)") from e

    try:
        data = json.loads(_strip_code_fences(raw))
    except json.JSONDecodeError:
        logger.warning("Gemini returned non-JSON: %s", raw[:500])
        raise

    conf = data.get("confidence", 0)
    try:
        conf = float(conf)
    except (TypeError, ValueError):
        conf = 0.0
    conf = max(0.0, min(1.0, conf))

    ans = data.get("answer")
    if ans is not None and isinstance(ans, str):
        ans = ans.strip() or None
    else:
        ans = None

    matched = data.get("matched_topic")
    if matched not in VALID_TOPICS:
        matched = None

    model_can = bool(data.get("can_answer"))
    # Server-side mandatory threshold (SOW): must be >= 0.75 and have grounded text
    can_answer = conf >= 0.75 and ans is not None
    if model_can and not can_answer:
        logger.debug("Model said can_answer but below threshold or empty answer; forcing decline.")

    return {
        "confidence": round(conf, 3),
        "can_answer": can_answer,
        "answer": ans if can_answer else None,
        "matched_topic": matched,
        "model_reported_can_answer": model_can,
    }
