"""Route decision — combines heuristics, classifier, and conversation state."""

import logging

from core.router.classifier import classify
from core.router.heuristics import has_secrets, heuristic_score

log = logging.getLogger(__name__)

ESCALATION_THRESHOLD = 4


async def decide(
    text: str,
    history: list[dict],
    conv: dict,
    claude_ready: bool,
) -> dict:
    """Decide where to route a message.

    Returns:
        {
            "target": "local" | "cloud",
            "model_hint": "sonnet" | "opus" | None,
            "reason": str,
            "complexity": int | None,
            "domain": str | None,
            "heuristic_score": int,
            "heuristic_flags": str,
            "classifier_json": str | None,
        }
    """
    # Privacy guard: secrets always stay local
    if has_secrets(text):
        return _result("local", reason="Privacy: secrets detected", heuristic_flags="secrets")

    # Sticky escalation
    if conv.get("escalated") and claude_ready:
        return _result("cloud", model_hint="sonnet", reason="Sticky escalation: continuing on Claude")

    # Heuristic pre-score
    h_score, h_reason = heuristic_score(text)

    # If heuristics already clearly local (very simple), skip the classifier
    if h_score == 0:
        return _result("local", reason=f"Heuristics: {h_reason}", heuristic_score=h_score, heuristic_flags=h_reason)

    # Run classifier
    classification = await classify(text)

    if classification:
        complexity = classification["complexity"]
        domain = classification["domain"]
        classifier_json = f'{{"complexity":{complexity},"domain":"{domain}"}}'

        if complexity >= ESCALATION_THRESHOLD and claude_ready:
            model_hint = "opus" if complexity >= 5 else "sonnet"
            return _result(
                "cloud",
                model_hint=model_hint,
                reason=f"Classifier: complexity {complexity}, domain {domain}",
                complexity=complexity,
                domain=domain,
                heuristic_score=h_score,
                heuristic_flags=h_reason,
                classifier_json=classifier_json,
            )

        return _result(
            "local",
            reason=f"Classifier: complexity {complexity}, domain {domain}",
            complexity=complexity,
            domain=domain,
            heuristic_score=h_score,
            heuristic_flags=h_reason,
            classifier_json=classifier_json,
        )

    # Classifier failed — fall back to heuristics
    if h_score >= 3 and claude_ready:
        return _result(
            "cloud",
            model_hint="sonnet",
            reason=f"Heuristics (classifier unavailable): {h_reason}",
            heuristic_score=h_score,
            heuristic_flags=h_reason,
        )

    return _result(
        "local",
        reason=f"Heuristics: {h_reason}",
        heuristic_score=h_score,
        heuristic_flags=h_reason,
    )


def _result(
    target: str,
    model_hint: str | None = None,
    reason: str = "",
    complexity: int | None = None,
    domain: str | None = None,
    heuristic_score: int = 0,
    heuristic_flags: str = "",
    classifier_json: str | None = None,
) -> dict:
    return {
        "target": target,
        "model_hint": model_hint,
        "reason": reason,
        "complexity": complexity,
        "domain": domain,
        "heuristic_score": heuristic_score,
        "heuristic_flags": heuristic_flags,
        "classifier_json": classifier_json,
    }
