from django.contrib import admin

from .models import Interview


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = (
        "application",
        "candidate",
        "round_name",
        "scheduled_at",
        "mode",
        "status",
    )
    list_filter = ("status", "mode", "scheduled_at")
    search_fields = (
        "application__candidate__user__email",
        "application__job__title",
        "round_name",
    )
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Candidate")
    def candidate(self, interview):
        return interview.application.candidate
