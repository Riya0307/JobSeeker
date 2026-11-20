import re
from typing import Any

from django.core.exceptions import ValidationError


# Deliberately small and explicit. Keys and values use the punctuation-normalized
# comparison form returned by _basic_skill_key. Ambiguous abbreviations (for
# example "py", "go", or "r") are intentionally excluded.
SKILL_ALIASES = {
    "amazon web services": "aws",
    "aws": "aws",
    "continuous integration continuous deployment": "ci cd",
    "continuous integration and continuous deployment": "ci cd",
    "ci cd": "ci cd",
    "javascript": "javascript",
    "js": "javascript",
    "node js": "node js",
    "nodejs": "node js",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "react": "react",
    "react js": "react",
    "ts": "typescript",
    "typescript": "typescript",
}


def _basic_skill_key(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    separated = re.sub(r"[^\w+#]+", " ", value.casefold(), flags=re.UNICODE)
    return " ".join(separated.split())


def normalize_skill(value: Any) -> str:
    """Return the deterministic, alias-aware comparison key shared by matching and alerts."""
    key = _basic_skill_key(value)
    return SKILL_ALIASES.get(key, key)


def normalize_job_skills(value: Any) -> list[str]:
    """Validate and deduplicate job skills while preserving useful display casing."""
    if not isinstance(value, list):
        raise ValidationError("Skills must be a list of text values.")

    normalized = []
    seen = set()
    for skill in value:
        if not isinstance(skill, str):
            raise ValidationError("Each skill must be text.")
        display = " ".join(skill.split())
        key = normalize_skill(display)
        if not key or key in seen:
            continue
        seen.add(key)
        normalized.append(display)
    return normalized
