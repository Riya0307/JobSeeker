from django.db import models
from django.core.validators import MinValueValidator

from apps.applications.models import Application


class Interview(models.Model):
    class Mode(models.TextChoices):
        ONLINE = "online", "Online"
        PHONE = "phone", "Phone"
        IN_PERSON = "in_person", "In person"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        RESCHEDULED = "rescheduled", "Rescheduled"

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="interviews",
    )
    round_name = models.CharField(max_length=255)
    scheduled_at = models.DateTimeField(db_index=True)
    duration_minutes = models.PositiveIntegerField(validators=(MinValueValidator(1),))
    mode = models.CharField(max_length=20, choices=Mode.choices)
    meeting_link = models.URLField(max_length=1000, blank=True)
    location = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True, max_length=10000)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("scheduled_at", "id")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(duration_minutes__gt=0),
                name="interview_duration_positive",
            )
        ]
        indexes = [
            models.Index(fields=("status", "scheduled_at")),
            models.Index(fields=("application", "scheduled_at")),
        ]

    def __str__(self):
        return f"{self.round_name} for application {self.application_id}"
