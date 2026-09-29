from django.core.management.base import BaseCommand

from apps.jobs.operations import provider_health, provider_names, provider_summary


class Command(BaseCommand):
    help = "Show provider ingestion status, job counts, and explicit health conditions."

    def add_arguments(self, parser):
        parser.add_argument("--provider")

    def handle(self, *args, **options):
        for provider in provider_names(options.get("provider")):
            summary = provider_summary(provider)
            health = provider_health(provider)
            success = summary["last_successful_run"]
            failure = summary["last_failed_run"]
            self.stdout.write(f"Provider: {provider}")
            if success:
                self.stdout.write(
                    "Last successful run: "
                    f"{success.finished_at} duration={summary['last_success_duration_seconds']}s "
                    f"fetched={success.fetched_count} created={success.created_count} "
                    f"updated={success.updated_count} unchanged={success.unchanged_count} "
                    f"rejected={success.rejected_count} deactivated={success.deactivated_count}"
                )
            else:
                self.stdout.write("Last successful run: never")
            if failure:
                self.stdout.write(
                    f"Last failed run: {failure.finished_at} error={failure.error_message}"
                )
            else:
                self.stdout.write("Last failed run: never")
            self.stdout.write(
                f"Current: running={health['running']} "
                f"active_jobs={health['active_job_count']} "
                f"inactive_jobs={health['inactive_job_count']}"
            )
            conditions = ", ".join(health["conditions"]) or "none"
            self.stdout.write(f"Health: {health['status']} conditions={conditions}")

