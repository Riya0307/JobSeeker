from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Mapping

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from .models import Job


INGESTIBLE_JOB_FIELDS = frozenset(
    {
        "title",
        "company_name",
        "description",
        "location",
        "employment_type",
        "work_mode",
        "experience_min",
        "experience_max",
        "salary_min",
        "salary_max",
        "skills",
        "application_url",
        "posted_at",
        "expires_at",
        "is_active",
    }
)


class IngestionStatus(StrEnum):
    CREATED = "created"
    UPDATED = "updated"
    UNCHANGED = "unchanged"


@dataclass(frozen=True)
class JobIngestionResult:
    job: Job
    status: IngestionStatus


def _validate_input(source: str, source_job_id: str, payload: Mapping[str, Any]):
    errors = {}
    if not isinstance(source, str) or not source.strip():
        errors["source"] = "Source is required."
    if not isinstance(source_job_id, str) or not source_job_id.strip():
        errors["source_job_id"] = "Source job ID is required."
    if not isinstance(payload, Mapping):
        errors["payload"] = "Payload must be a mapping of job fields."
    else:
        unsupported = sorted(
            str(field)
            for field in payload
            if not isinstance(field, str) or field not in INGESTIBLE_JOB_FIELDS
        )
        if unsupported:
            errors["payload"] = f"Unsupported or server-controlled fields: {', '.join(unsupported)}."
    if errors:
        raise ValidationError(errors)


def _update_existing(job: Job, payload: Mapping[str, Any]) -> JobIngestionResult:
    previous = {field: getattr(job, field) for field in INGESTIBLE_JOB_FIELDS}
    for field, value in payload.items():
        setattr(job, field, value)

    # Validate and normalize before comparing so equivalent skill payloads are
    # true no-ops and do not retrigger downstream job-alert evaluation.
    job.full_clean()
    changed = any(previous[field] != getattr(job, field) for field in INGESTIBLE_JOB_FIELDS)
    if not changed:
        return JobIngestionResult(job=job, status=IngestionStatus.UNCHANGED)
    job.save()
    return JobIngestionResult(job=job, status=IngestionStatus.UPDATED)


def ingest_job(source: str, source_job_id: str, payload: Mapping[str, Any]) -> JobIngestionResult:
    """Atomically validate and upsert one provider-agnostic source job.

    Invalid input raises Django ``ValidationError`` and persists nothing. The
    database uniqueness constraint on ``(source, source_job_id)`` remains the
    final authority during concurrent ingestion.
    """
    _validate_input(source, source_job_id, payload)
    source = source.strip()
    source_job_id = source_job_id.strip()

    with transaction.atomic():
        existing = Job.objects.select_for_update().filter(
            source=source, source_job_id=source_job_id
        ).first()
        if existing is not None:
            return _update_existing(existing, payload)

        try:
            # The nested savepoint keeps the outer transaction usable if a
            # concurrent worker wins the unique-key race.
            with transaction.atomic():
                job = Job.objects.create(
                    source=source,
                    source_job_id=source_job_id,
                    **payload,
                )
        except IntegrityError as error:
            try:
                existing = Job.objects.select_for_update().get(
                    source=source, source_job_id=source_job_id
                )
            except Job.DoesNotExist:
                raise error
            return _update_existing(existing, payload)
        return JobIngestionResult(job=job, status=IngestionStatus.CREATED)
