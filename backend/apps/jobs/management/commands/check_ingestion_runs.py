from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.jobs.operations import stuck_runs


class Command(BaseCommand):
    help = "Identify old running ingestion runs without changing their state."

    def add_arguments(self, parser):
        parser.add_argument("--provider")

    def handle(self, *args, **options):
        now = timezone.now()
        runs = list(stuck_runs(options.get("provider"), now=now))
        if not runs:
            self.stdout.write(self.style.SUCCESS("No stuck ingestion runs found."))
            return
        for run in runs:
            age_hours = (now - run.started_at).total_seconds() / 3600
            self.stdout.write(
                f"run_id={run.pk} provider={run.provider} started_at={run.started_at} "
                f"age_hours={age_hours:.2f} recovery_command=python manage.py "
                f"recover_ingestion_run {run.pk}"
            )
