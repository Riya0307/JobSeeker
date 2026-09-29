from collections import Counter

from django.core.management.base import BaseCommand, CommandError

from apps.jobs.ingestion import (
    DEFAULT_INGESTION_LIMIT,
    MAX_INGESTION_LIMIT,
    FullSnapshotNotVerified,
    IngestionAlreadyRunning,
    run_arbeitnow_ingestion,
)
from apps.jobs.providers.arbeitnow import ArbeitnowProviderError


class Command(BaseCommand):
    help = "Fetch and ingest one bounded page of jobs from Arbeitnow."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=DEFAULT_INGESTION_LIMIT)
        parser.add_argument("--full-snapshot", action="store_true")

    def handle(self, *args, **options):
        limit = options["limit"]
        if not 1 <= limit <= MAX_INGESTION_LIMIT:
            raise CommandError(f"--limit must be between 1 and {MAX_INGESTION_LIMIT}")
        try:
            execution = run_arbeitnow_ingestion(
                limit=limit,
                full_snapshot=options["full_snapshot"],
            )
        except (
            ArbeitnowProviderError,
            FullSnapshotNotVerified,
            IngestionAlreadyRunning,
        ) as error:
            raise CommandError(str(error)) from error
        report = execution.report
        run = execution.run

        for rejected in report.rejected:
            self.stderr.write(
                self.style.WARNING(f"Rejected {rejected.source_job_id}: {rejected.reason}")
            )
        if report.rejected:
            self.stderr.write("Rejection summary:")
            reasons = Counter(rejected.reason for rejected in report.rejected)
            for reason, count in sorted(reasons.items(), key=lambda item: (-item[1], item[0])):
                self.stderr.write(f"- {reason}: {count}")
        self.stdout.write(
            self.style.SUCCESS(
                "Arbeitnow ingestion complete: "
                f"run_id={run.pk} provider={run.provider} "
                f"fetched={run.fetched_count} processed={run.processed_count} "
                f"created={run.created_count} updated={run.updated_count} "
                f"unchanged={run.unchanged_count} rejected={run.rejected_count} "
                f"deactivated={run.deactivated_count} status={run.status}"
            )
        )
