import re
from typing import Any

from django.core.exceptions import ValidationError


def normalize_skill(value: Any) -> str:
    """Return the deterministic comparison form shared by jobs, matching, and alerts."""
    if not isinstance(value, str):
        return ""
    separated = re.sub(r"[^\w+#]+", " ", value.casefold(), flags=re.UNICODE)
    return " ".join(separated.split())


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
