from django.core.management.base import BaseCommand, CommandError

from apps.jobs.models import IngestionRun


class Command(BaseCommand):
    help = "List recent ingestion runs in newest-first order."

    def add_arguments(self, parser):
        parser.add_argument("--provider")
        parser.add_argument("--status")
        parser.add_argument("--trigger")
        parser.add_argument("--limit", type=int, default=10)

    def handle(self, *args, **options):
        limit = options["limit"]
        if not 1 <= limit <= 100:
            raise CommandError("limit must be between 1 and 100")
        status = options.get("status")
        if status and status not in IngestionRun.Status.values:
            raise CommandError("status must be running, completed, or failed")
        trigger = options.get("trigger")
        if trigger and trigger not in IngestionRun.Trigger.values:
            raise CommandError("trigger must be manual or scheduled")
        queryset = IngestionRun.objects.all()
        if provider := options.get("provider"):
            queryset = queryset.filter(provider=provider)
        if status:
            queryset = queryset.filter(status=status)
        if trigger:
            queryset = queryset.filter(trigger=trigger)

        self.stdout.write(
            "ID | Provider | Trigger | Status | Started | Fetched | Created | Updated | "
            "Unchanged | Rejected | Deactivated"
        )
        for run in queryset.order_by("-started_at", "-id")[:limit]:
            self.stdout.write(
                f"{run.pk} | {run.provider} | {run.trigger} | {run.status} | {run.started_at} | "
                f"{run.fetched_count} | {run.created_count} | {run.updated_count} | "
                f"{run.unchanged_count} | {run.rejected_count} | {run.deactivated_count}"
            )
