from celery import shared_task
from django.conf import settings

from .ingestion import IngestionAlreadyRunning, run_provider_ingestion
from .models import IngestionRun
from .providers.registry import get_provider


def _run_provider_task(task, provider: str, limit: int | None):
    adapter = get_provider(provider)
    configured_limit = adapter.default_limit if limit is None else limit
    try:
        execution = run_provider_ingestion(
            provider=adapter.identifier,
            limit=configured_limit,
            trigger=IngestionRun.Trigger.SCHEDULED,
        )
    except IngestionAlreadyRunning:
        return {
            "provider": adapter.identifier,
            "status": "already_running",
            "retrying": False,
        }
    except Exception as error:
        if not adapter.is_transient_error(error):
            raise
        countdown = adapter.retry_backoff_seconds * (2**task.request.retries)
        raise task.retry(
            exc=error,
            countdown=countdown,
            max_retries=adapter.max_retries,
        ) from error
    run = execution.run
    return {
        "run_id": run.pk,
        "provider": run.provider,
        "status": run.status,
        "fetched": run.fetched_count,
        "processed": run.processed_count,
        "created": run.created_count,
        "updated": run.updated_count,
        "unchanged": run.unchanged_count,
        "rejected": run.rejected_count,
        "deactivated": run.deactivated_count,
        "rejection_reasons": run.rejection_reasons,
    }


@shared_task(bind=True, name="jobs.ingest_provider", max_retries=5)
def ingest_provider_task(self, provider: str, limit: int | None = None):
    return _run_provider_task(self, provider, limit)


@shared_task(
    bind=True,
    name="jobs.ingest_arbeitnow",
    max_retries=settings.JOB_INGEST_ARBEITNOW_MAX_RETRIES,
)
def ingest_arbeitnow_task(self, limit: int | None = None):
    return _run_provider_task(self, "arbeitnow", limit)
