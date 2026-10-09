from django.contrib import admin

from .models import Resume, ResumeParsedData


@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    list_display = ("title", "candidate", "file_name", "is_primary", "updated_at")
    list_filter = ("is_primary",)
    search_fields = ("title", "file_name", "candidate__user__email")


@admin.register(ResumeParsedData)
class ResumeParsedDataAdmin(admin.ModelAdmin):
    list_display = ("resume", "status", "parser_version", "extracted_at", "updated_at")
    list_filter = ("status", "parser_version")
    search_fields = ("resume__title", "resume__candidate__user__email")
    readonly_fields = ("file_hash", "extracted_text", "created_at", "updated_at")
