from django.core.management.base import BaseCommand, CommandError

from apps.jobs.providers.arbeitnow import (
    MAX_BATCH_SIZE,
    ArbeitnowProviderError,
    ingest_arbeitnow_jobs,
)


class Command(BaseCommand):
    help = "Fetch and ingest one bounded page of jobs from Arbeitnow."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=25)

    def handle(self, *args, **options):
        limit = options["limit"]
        if not 1 <= limit <= MAX_BATCH_SIZE:
            raise CommandError(f"--limit must be between 1 and {MAX_BATCH_SIZE}")
        try:
            report = ingest_arbeitnow_jobs(limit=limit)
        except ArbeitnowProviderError as error:
            raise CommandError(str(error)) from error

        for rejected in report.rejected:
            self.stderr.write(
                self.style.WARNING(f"Rejected {rejected.source_job_id}: {rejected.reason}")
            )
        self.stdout.write(
            self.style.SUCCESS(
                "Arbeitnow ingestion complete: "
                f"fetched={report.fetched} processed={report.processed} "
                f"created={report.created} updated={report.updated} "
                f"unchanged={report.unchanged} rejected={len(report.rejected)}"
            )
        )
