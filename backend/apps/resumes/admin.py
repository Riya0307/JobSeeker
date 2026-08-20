from django.contrib import admin

from .models import Resume


@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    list_display = ("title", "candidate", "file_name", "is_primary", "updated_at")
    list_filter = ("is_primary",)
    search_fields = ("title", "file_name", "candidate__user__email")
