from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.jobs.models import IngestionRun


class Command(BaseCommand):
    help = "Explicitly mark one stuck running ingestion as failed and release its provider lock."

    def add_arguments(self, parser):
        parser.add_argument("run_id", type=int)

    def handle(self, *args, **options):
        with transaction.atomic():
            try:
                run = IngestionRun.objects.select_for_update().get(pk=options["run_id"])
            except IngestionRun.DoesNotExist as error:
                raise CommandError("Ingestion run not found.") from error
            if run.status != IngestionRun.Status.RUNNING or not run.running_lock:
                raise CommandError("Only an active running ingestion can be recovered.")
            run.status = IngestionRun.Status.FAILED
            run.finished_at = timezone.now()
            run.error_message = "Manually recovered after an interrupted worker run."
            run.running_lock = None
            run.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Recovered ingestion run {run.pk}; provider={run.provider} status={run.status}"
            )
        )
