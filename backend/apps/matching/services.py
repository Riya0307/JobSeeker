import re
from dataclasses import dataclass
from typing import Any

from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.candidates.models import CandidateProfile
from apps.jobs.models import Job


# Scores total 100: skills 50, experience 20, location 15, work mode 15.
SKILLS_WEIGHT = 50
EXPERIENCE_WEIGHT = 20
LOCATION_WEIGHT = 15
WORK_MODE_WEIGHT = 15


@dataclass(frozen=True)
class MatchResult:
    job: Job
    match_score: int
    matched_skills: list[str]
    missing_skills: list[str]
    reasons: list[str]


def available_jobs() -> QuerySet[Job]:
    """Return jobs candidates can currently discover and match against."""
    now = timezone.now()
    return Job.objects.filter(is_active=True).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))


def normalize_skill(value: Any) -> str:
    """Normalize case, whitespace, and separator punctuation without fuzzy matching."""
    if not isinstance(value, str):
        return ""
    separated = re.sub(r"[^\w+#]+", " ", value.casefold(), flags=re.UNICODE)
    return " ".join(separated.split())


def _valid_skills(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [skill.strip() for skill in value if isinstance(skill, str) and skill.strip()]


def _score_skills(candidate_skills: Any, job_skills: Any):
    required = _valid_skills(job_skills)
    candidate_normalized = {normalize_skill(skill) for skill in _valid_skills(candidate_skills)}
    candidate_normalized.discard("")

    matched = [skill for skill in required if normalize_skill(skill) in candidate_normalized]
    missing = [skill for skill in required if normalize_skill(skill) not in candidate_normalized]
    if not required:
        return SKILLS_WEIGHT, matched, missing, "No required skills are listed; skills were not penalized"

    score = int((len(matched) / len(required)) * SKILLS_WEIGHT + 0.5)
    ratio = len(matched) / len(required)
    if ratio >= 0.8:
        reason = "Strong skills match"
    elif matched:
        reason = "Several required skills are missing"
    else:
        reason = "Required skills are missing"
    return score, matched, missing, reason


def _score_experience(candidate_years: Any, minimum: Any, maximum: Any):
    years = candidate_years if isinstance(candidate_years, int) and candidate_years >= 0 else 0
    minimum = minimum if isinstance(minimum, int) and minimum >= 0 else None
    maximum = maximum if isinstance(maximum, int) and maximum >= 0 else None

    if minimum is None and maximum is None:
        return EXPERIENCE_WEIGHT, "No experience range is specified"
    if minimum is not None and years < minimum:
        gap = minimum - years
        # One/two/three-or-more years below minimum receive 15/10/5 points.
        return max(5, EXPERIENCE_WEIGHT - gap * 5), "Experience is below the preferred range"
    if maximum is not None and years > maximum:
        return 18, "Experience exceeds the preferred range but remains compatible"
    return EXPERIENCE_WEIGHT, "Experience requirement is compatible"


def _normalize_location(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(re.sub(r"[^\w]+", " ", value.casefold()).split())


def _score_location(candidate_location: Any, job_location: Any, work_mode: Any):
    if work_mode == Job.WorkMode.REMOTE:
        return LOCATION_WEIGHT, "Remote work is location-compatible"
    candidate = _normalize_location(candidate_location)
    location = _normalize_location(job_location)
    if not candidate or not location:
        return 8, "Location compatibility is unknown"
    if candidate == location:
        return LOCATION_WEIGHT, "Location matches"
    return 0, "Job location differs from candidate location"


def _score_work_mode(work_mode: Any):
    # CandidateProfile currently has no work-mode preference. Missing preference
    # must remain neutral, so every recognized mode receives the full component.
    label = dict(Job.WorkMode.choices).get(work_mode, "Job work mode")
    return WORK_MODE_WEIGHT, f"{label} work is compatible; no work-mode preference is specified"


def calculate_match(candidate: CandidateProfile, job: Job) -> MatchResult:
    """Authoritative deterministic scoring implementation for all matching APIs."""
    skill_score, matched, missing, skill_reason = _score_skills(candidate.skills, job.skills)
    experience_score, experience_reason = _score_experience(
        candidate.years_of_experience, job.experience_min, job.experience_max
    )
    location_score, location_reason = _score_location(
        candidate.location, job.location, job.work_mode
    )
    work_mode_score, work_mode_reason = _score_work_mode(job.work_mode)
    score = min(
        100,
        max(0, skill_score + experience_score + location_score + work_mode_score),
    )
    return MatchResult(
        job=job,
        match_score=score,
        matched_skills=matched,
        missing_skills=missing,
        reasons=[skill_reason, experience_reason, location_reason, work_mode_reason],
    )
