import logging
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


def _start_run(provider: str, full_snapshot: bool) -> IngestionRun:
    try:
        # Keep a uniqueness conflict inside a savepoint so the surrounding
        # request/test transaction remains usable for deterministic reporting.
        with transaction.atomic():
            return IngestionRun.objects.create(
                provider=provider,
                status=IngestionRun.Status.RUNNING,
                full_snapshot=full_snapshot,
                running_lock=provider,
            )
    except IntegrityError as error:
        if IngestionRun.objects.filter(running_lock=provider).exists():
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
    return deactivated


def execute_ingestion_run(
    *,
    provider: str,
    limit: int,
    fetcher: Callable[[int], list[Mapping]],
    processor: Callable[[Iterable[Mapping], object], BatchIngestionReport],
    full_snapshot: bool = False,
    snapshot_complete: bool = False,
) -> IngestionExecution:
    """Execute one tracked ingestion run with atomic writes and optional stale handling."""
    validate_limit(limit)
    if full_snapshot and not snapshot_complete:
        raise FullSnapshotNotVerified(
            f"{provider} did not prove that the fetched data is a complete snapshot."
        )
    run = _start_run(provider, full_snapshot)
    empty_report = BatchIngestionReport()
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
            run.error_message = ""
            run.running_lock = None
            run.save()
        logger.info("Completed %s ingestion run %s", provider, run.pk)
        return IngestionExecution(run=run, report=report)
    except Exception as error:
        finished_at = timezone.now()
        run.status = IngestionRun.Status.FAILED
        run.finished_at = finished_at
        run.error_message = str(error)[:MAX_ERROR_LENGTH]
        run.running_lock = None
        run.save()
        logger.exception("Failed %s ingestion run %s", provider, run.pk)
        raise


def run_arbeitnow_ingestion(
    limit: int = DEFAULT_INGESTION_LIMIT,
    *,
    full_snapshot: bool = False,
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
    )
