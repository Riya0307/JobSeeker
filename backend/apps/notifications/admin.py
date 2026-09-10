from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("candidate", "notification_type", "title", "is_read", "created_at")
    list_filter = ("notification_type", "is_read", "created_at")
    search_fields = ("candidate__user__email", "title", "message")
    readonly_fields = ("candidate", "notification_type", "title", "message", "application", "interview", "event_key", "created_at")
