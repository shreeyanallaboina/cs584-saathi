"""Chat orchestration: grounded Gemini when GEMINI_API_KEY (or GOOGLE_API_KEY) is set, else heuristic fallback."""
from __future__ import annotations

import logging
import os

from chat_logic import score_query
from llm_chat import complete_llm, gemini_api_key, load_knowledge_base_text

logger = logging.getLogger(__name__)

DISCLAIMER = (
    " This information is for general education only and is not a substitute for care "
    "from a qualified health worker or doctor."
)


def run_chat(message: str, topic: str | None) -> dict:
    """
    Returns keys: confidence, can_answer, answer, matched_topic, suggest_forum, forum_prefill,
    source (llm | heuristic).
    """
    use_llm = bool(gemini_api_key())

    if use_llm:
        try:
            kb = load_knowledge_base_text()
            out = complete_llm(message, topic, kb)
            ans = out["answer"]
            if ans:
                ans = ans.rstrip() + DISCLAIMER
            can_answer = out["can_answer"]
            return {
                "confidence": out["confidence"],
                "can_answer": can_answer,
                "answer": ans if can_answer else None,
                "matched_topic": out["matched_topic"],
                "suggest_forum": not can_answer,
                "forum_prefill": message if not can_answer else None,
                "source": "llm",
            }
        except Exception:
            logger.exception("LLM chat failed; falling back to heuristic scorer")
            # fall through to heuristic

    confidence, matched_topic, answer = score_query(message, topic)
    can_answer = confidence >= 0.75 and answer is not None
    return {
        "confidence": round(confidence, 3),
        "can_answer": can_answer,
        "answer": answer if can_answer else None,
        "matched_topic": matched_topic,
        "suggest_forum": not can_answer,
        "forum_prefill": message if not can_answer else None,
        "source": "heuristic",
    }
