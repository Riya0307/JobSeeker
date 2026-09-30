from celery import shared_task
from django.conf import settings

from .ingestion import IngestionAlreadyRunning, run_arbeitnow_ingestion
from .models import IngestionRun
from .providers.arbeitnow import TransientArbeitnowProviderError


@shared_task(
    bind=True,
    name="jobs.ingest_arbeitnow",
    max_retries=settings.JOB_INGEST_ARBEITNOW_MAX_RETRIES,
)
def ingest_arbeitnow_task(self, limit: int | None = None):
    configured_limit = settings.JOB_INGEST_ARBEITNOW_LIMIT if limit is None else limit
    try:
        execution = run_arbeitnow_ingestion(
            limit=configured_limit,
            trigger=IngestionRun.Trigger.SCHEDULED,
        )
    except IngestionAlreadyRunning:
        return {
            "provider": "arbeitnow",
            "status": "already_running",
            "retrying": False,
        }
    except TransientArbeitnowProviderError as error:
        countdown = settings.JOB_INGEST_ARBEITNOW_RETRY_BACKOFF_SECONDS * (
            2**self.request.retries
        )
        raise self.retry(exc=error, countdown=countdown) from error
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
