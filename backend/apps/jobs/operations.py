from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.utils import timezone

from .models import IngestionRun, Job
from .providers.registry import provider_identifiers


def provider_names(provider: str | None = None) -> list[str]:
    if provider and provider.strip():
        return [provider.strip()]
    discovered = set(provider_identifiers())
    discovered.update(IngestionRun.objects.values_list("provider", flat=True).distinct())
    return sorted(name for name in discovered if name)


def _job_counts(provider: str) -> tuple[int, int]:
    counts = Job.objects.filter(source=provider).exclude(source_job_id="").aggregate(
        active=Count("id", filter=Q(is_active=True)),
        inactive=Count("id", filter=Q(is_active=False)),
    )
    return counts["active"], counts["inactive"]


def _duration_seconds(run: IngestionRun | None):
    if run is None or run.finished_at is None:
        return None
    return round((run.finished_at - run.started_at).total_seconds(), 3)


def provider_summary(provider: str) -> dict:
    runs = IngestionRun.objects.filter(provider=provider)
    successful = runs.filter(status=IngestionRun.Status.COMPLETED).first()
    failed = runs.filter(status=IngestionRun.Status.FAILED).first()
    running = runs.filter(status=IngestionRun.Status.RUNNING).first()
    active_count, inactive_count = _job_counts(provider)
    return {
        "provider": provider,
        "last_successful_run": successful,
        "last_failed_run": failed,
        "running_run": running,
        "last_success_duration_seconds": _duration_seconds(successful),
        "active_job_count": active_count,
        "inactive_job_count": inactive_count,
    }


def provider_health(provider: str, now=None) -> dict:
    now = now or timezone.now()
    summary = provider_summary(provider)
    successful = summary["last_successful_run"]
    failed = summary["last_failed_run"]
    running = summary["running_run"]
    latest = IngestionRun.objects.filter(provider=provider).first()
    conditions = []

    if running is not None:
        conditions.append("running")
    if successful is None:
        conditions.append("never_succeeded")
    stale = False
    if successful is not None:
        stale_after = timedelta(hours=settings.JOB_INGESTION_HEALTH_STALE_AFTER_HOURS)
        stale = successful.finished_at is None or successful.finished_at < now - stale_after
        if stale:
            conditions.append("last_success_stale")

    rejection_rate = None
    if successful is not None and successful.processed_count:
        rejection_rate = successful.rejected_count / successful.processed_count
        if rejection_rate >= settings.JOB_INGESTION_HIGH_REJECTION_RATE:
            conditions.append("high_rejection_rate")

    zero_active = (
        summary["active_job_count"] == 0 and summary["inactive_job_count"] > 0
    )
    if zero_active:
        conditions.append("zero_active_jobs")

    latest_failed = latest is not None and latest.status == IngestionRun.Status.FAILED
    if latest_failed:
        conditions.append("latest_run_failed")
    status = "failed" if latest_failed else "warning" if conditions else "healthy"

    return {
        "provider": provider,
        "status": status,
        "conditions": conditions,
        "last_success_at": successful.finished_at if successful else None,
        "last_failure_at": failed.finished_at if failed else None,
        "running": running is not None,
        "stale": stale,
        "rejection_rate": round(rejection_rate, 4) if rejection_rate is not None else None,
        "active_job_count": summary["active_job_count"],
        "inactive_job_count": summary["inactive_job_count"],
    }


def stuck_runs(provider: str | None = None, now=None):
    now = now or timezone.now()
    cutoff = now - timedelta(hours=settings.JOB_INGESTION_STUCK_AFTER_HOURS)
    queryset = IngestionRun.objects.filter(
        status=IngestionRun.Status.RUNNING,
        started_at__lt=cutoff,
    )
    if provider:
        queryset = queryset.filter(provider=provider)
    return queryset.order_by("started_at", "id")
