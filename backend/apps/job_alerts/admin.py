from django.contrib import admin

from .models import JobAlert


@admin.register(JobAlert)
class JobAlertAdmin(admin.ModelAdmin):
    list_display = (
        "candidate",
        "name",
        "is_active",
        "created_at",
        "updated_at",
        "last_checked_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("candidate__user__email", "name", "keywords", "location")
    readonly_fields = ("candidate", "created_at", "updated_at", "last_checked_at")
