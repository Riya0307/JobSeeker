from collections import Counter

from django.core.management.base import BaseCommand, CommandError

from apps.jobs.ingestion import (
    FullSnapshotNotVerified,
    IngestionAlreadyRunning,
    run_provider_ingestion,
)
from apps.jobs.providers.registry import UnknownProviderError, get_provider


class Command(BaseCommand):
    help = "Fetch and ingest one bounded batch from a registered job provider."

    def add_arguments(self, parser):
        parser.add_argument("provider")
        parser.add_argument("--limit", type=int)
        parser.add_argument("--full-snapshot", action="store_true")

    def handle(self, *args, **options):
        try:
            adapter = get_provider(options["provider"])
            limit = adapter.default_limit if options["limit"] is None else options["limit"]
            if not 1 <= limit <= adapter.max_batch_size:
                raise CommandError(
                    f"--limit must be between 1 and {adapter.max_batch_size}"
                )
            execution = run_provider_ingestion(
                adapter.identifier,
                limit=limit,
                full_snapshot=options["full_snapshot"],
            )
        except (UnknownProviderError, FullSnapshotNotVerified, IngestionAlreadyRunning) as error:
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
                "Provider ingestion complete: "
                f"run_id={run.pk} provider={run.provider} "
                f"fetched={run.fetched_count} processed={run.processed_count} "
                f"created={run.created_count} updated={run.updated_count} "
                f"unchanged={run.unchanged_count} rejected={run.rejected_count} "
                f"deactivated={run.deactivated_count} status={run.status}"
            )
        )
