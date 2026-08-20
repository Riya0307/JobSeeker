from django.contrib import admin

from .models import Job, SavedJob


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company_name", "location", "work_mode", "is_active", "posted_at")
    list_filter = ("is_active", "work_mode", "employment_type", "source")
    search_fields = ("title", "company_name", "location", "source_job_id")


@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ("candidate", "job", "created_at")
    search_fields = ("candidate__user__email", "job__title", "job__company_name")
