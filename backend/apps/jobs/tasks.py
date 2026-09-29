from celery import shared_task

from .ingestion import DEFAULT_INGESTION_LIMIT, run_arbeitnow_ingestion


@shared_task(name="jobs.ingest_arbeitnow")
def ingest_arbeitnow_task(limit: int = DEFAULT_INGESTION_LIMIT):
    execution = run_arbeitnow_ingestion(limit=limit)
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
    }
