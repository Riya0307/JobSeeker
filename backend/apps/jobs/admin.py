from django.contrib import admin

from .models import IngestionRun, Job, SavedJob


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company_name", "location", "work_mode", "is_active", "posted_at")
    list_filter = ("is_active", "work_mode", "employment_type", "source")
    search_fields = ("title", "company_name", "location", "source_job_id")


@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ("candidate", "job", "created_at")
    search_fields = ("candidate__user__email", "job__title", "job__company_name")


@admin.register(IngestionRun)
class IngestionRunAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "provider",
        "trigger",
        "status",
        "started_at",
        "finished_at",
        "fetched_count",
        "created_count",
        "updated_count",
        "unchanged_count",
        "rejected_count",
        "deactivated_count",
    )
    list_filter = ("provider", "trigger", "status", "full_snapshot", "started_at")
    search_fields = ("provider", "error_message")
    readonly_fields = (
        "provider",
        "trigger",
        "status",
        "started_at",
        "finished_at",
        "full_snapshot",
        "fetched_count",
        "processed_count",
        "created_count",
        "updated_count",
        "unchanged_count",
        "rejected_count",
        "deactivated_count",
        "rejection_reasons",
        "error_message",
        "running_lock",
    )
