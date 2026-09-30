import logging
from collections import Counter
from dataclasses import dataclass
from datetime import timedelta
from typing import Callable, Iterable, Mapping

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from .models import IngestionRun, Job
from .providers.arbeitnow import BatchIngestionReport


logger = logging.getLogger(__name__)
DEFAULT_INGESTION_LIMIT = 25
MAX_INGESTION_LIMIT = 100
MAX_ERROR_LENGTH = 2000


def normalize_rejection_reason(reason: str) -> str:
    """Map provider/model errors to bounded operational categories."""
    value = " ".join(str(reason).casefold().split())
    if "ambiguous" in value and "employment" in value:
        return "ambiguous employment type"
    if "unsupported" in value and "employment" in value:
        return "unsupported employment type"
    if "job_types" in value or "employment_type" in value or "employment type" in value:
        return "employment type required"
    if "location" in value:
        return "location required"
    if "url" in value:
        return "invalid URL"
    if "salary" in value:
        return "invalid salary"
    if "experience" in value:
        return "invalid experience"
    if "skill" in value or "tag" in value:
        return "invalid skills"
    return "provider payload invalid"


class IngestionAlreadyRunning(RuntimeError):
    pass


class FullSnapshotNotVerified(RuntimeError):
    pass


@dataclass(frozen=True)
class IngestionExecution:
    run: IngestionRun
    report: BatchIngestionReport


def validate_limit(limit: int) -> int:
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= MAX_INGESTION_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_INGESTION_LIMIT}")
    return limit


def _start_run(provider: str, full_snapshot: bool, trigger: str) -> IngestionRun:
    try:
        # Keep a uniqueness conflict inside a savepoint so the surrounding
        # request/test transaction remains usable for deterministic reporting.
        with transaction.atomic():
            run = IngestionRun.objects.create(
                provider=provider,
                trigger=trigger,
                status=IngestionRun.Status.RUNNING,
                full_snapshot=full_snapshot,
                running_lock=provider,
            )
            logger.info(
                "job_ingestion_started",
                extra={
                    "provider": provider,
                    "trigger": trigger,
                    "ingestion_run_id": run.pk,
                },
            )
            return run
    except IntegrityError as error:
        if IngestionRun.objects.filter(running_lock=provider).exists():
            logger.warning(
                "job_ingestion_concurrency_rejected",
                extra={"provider": provider},
            )
            raise IngestionAlreadyRunning(f"An ingestion run for {provider} is already active.") from error
        raise


def deactivate_stale_provider_jobs(
    provider: str,
    snapshot_at,
    grace_period: timedelta | None = None,
) -> int:
    """Deactivate only provider jobs missed beyond a verified snapshot grace period."""
    if grace_period is None:
        grace_period = timedelta(hours=settings.JOB_PROVIDER_STALE_GRACE_HOURS)
    cutoff = snapshot_at - grace_period
    candidates = (
        Job.objects.select_for_update()
        .filter(source=provider, is_active=True)
        .exclude(source_job_id="")
        .filter(
            Q(provider_last_seen_at__lt=cutoff)
            | Q(provider_last_seen_at__isnull=True, updated_at__lt=cutoff)
        )
        .order_by("pk")
    )
    deactivated = 0
    for job in candidates:
        job.is_active = False
        job.save(update_fields=("is_active", "updated_at"))
        deactivated += 1
    logger.info(
        "job_ingestion_stale_deactivation_completed",
        extra={"provider": provider, "deactivated_count": deactivated},
    )
    return deactivated


def execute_ingestion_run(
    *,
    provider: str,
    limit: int,
    fetcher: Callable[[int], list[Mapping]],
    processor: Callable[[Iterable[Mapping], object], BatchIngestionReport],
    full_snapshot: bool = False,
    snapshot_complete: bool = False,
    trigger: str = IngestionRun.Trigger.MANUAL,
) -> IngestionExecution:
    """Execute one tracked ingestion run with atomic writes and optional stale handling."""
    validate_limit(limit)
    if trigger not in IngestionRun.Trigger.values:
        raise ValueError("trigger must be manual or scheduled")
    if full_snapshot and not snapshot_complete:
        raise FullSnapshotNotVerified(
            f"{provider} did not prove that the fetched data is a complete snapshot."
        )
    run = _start_run(provider, full_snapshot, trigger)
    try:
        records = fetcher(limit)
        run.fetched_count = len(records)
        run.save(update_fields=("fetched_count",))
        with transaction.atomic():
            report = processor(records, run.started_at)
            deactivated = 0
            if full_snapshot:
                deactivated = deactivate_stale_provider_jobs(provider, run.started_at)
            finished_at = timezone.now()
            run.status = IngestionRun.Status.COMPLETED
            run.finished_at = finished_at
            run.processed_count = report.processed
            run.created_count = report.created
            run.updated_count = report.updated
            run.unchanged_count = report.unchanged
            run.rejected_count = len(report.rejected)
            run.deactivated_count = deactivated
            run.rejection_reasons = dict(
                Counter(
                    normalize_rejection_reason(rejected.reason)
                    for rejected in report.rejected
                )
            )
            run.error_message = ""
            run.running_lock = None
            run.save()
        logger.info(
            "job_ingestion_completed",
            extra={
                "provider": provider,
                "trigger": run.trigger,
                "ingestion_run_id": run.pk,
                "fetched_count": run.fetched_count,
                "processed_count": run.processed_count,
                "created_count": run.created_count,
                "updated_count": run.updated_count,
                "unchanged_count": run.unchanged_count,
                "rejected_count": run.rejected_count,
                "deactivated_count": run.deactivated_count,
            },
        )
        return IngestionExecution(run=run, report=report)
    except Exception as error:
        finished_at = timezone.now()
        run.status = IngestionRun.Status.FAILED
        run.finished_at = finished_at
        run.error_message = str(error)[:MAX_ERROR_LENGTH]
        run.running_lock = None
        run.save()
        logger.exception(
            "job_ingestion_failed",
            extra={
                "provider": provider,
                "trigger": run.trigger,
                "ingestion_run_id": run.pk,
                "error_type": type(error).__name__,
            },
        )
        raise


def run_arbeitnow_ingestion(
    limit: int = DEFAULT_INGESTION_LIMIT,
    *,
    full_snapshot: bool = False,
    trigger: str = IngestionRun.Trigger.MANUAL,
) -> IngestionExecution:
    # Arbeitnow's current adapter fetches a bounded first page and cannot prove
    # complete traversal. Full-snapshot stale handling is therefore disabled.
    if full_snapshot:
        raise FullSnapshotNotVerified(
            "Arbeitnow does not currently expose verified complete-snapshot semantics."
        )
    from .providers.arbeitnow import SOURCE, fetch_jobs, ingest_records

    return execute_ingestion_run(
        provider=SOURCE,
        limit=limit,
        fetcher=fetch_jobs,
        processor=lambda records, observed_at: ingest_records(
            records, observed_at=observed_at
        ),
        trigger=trigger,
    )
