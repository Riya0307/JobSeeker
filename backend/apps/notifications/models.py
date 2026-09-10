from django.db import models

from apps.applications.models import Application
from apps.candidates.models import CandidateProfile
from apps.interviews.models import Interview


class Notification(models.Model):
    class Type(models.TextChoices):
        APPLICATION_SUBMITTED = "application_submitted", "Application submitted"
        APPLICATION_WITHDRAWN = "application_withdrawn", "Application withdrawn"
        INTERVIEW_SCHEDULED = "interview_scheduled", "Interview scheduled"
        INTERVIEW_RESCHEDULED = "interview_rescheduled", "Interview rescheduled"
        INTERVIEW_CANCELLED = "interview_cancelled", "Interview cancelled"
        INTERVIEW_COMPLETED = "interview_completed", "Interview completed"

    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(max_length=32, choices=Type.choices)
    title = models.CharField(max_length=255)
    message = models.TextField(max_length=1000)
    is_read = models.BooleanField(default=False)
    application = models.ForeignKey(
        Application,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    interview = models.ForeignKey(
        Interview,
        on_delete=models.SET_NULL,
        related_name="notifications",
        null=True,
        blank=True,
    )
    event_key = models.CharField(max_length=255, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    notification_type__in=(
                        "application_submitted",
                        "application_withdrawn",
                        "interview_scheduled",
                        "interview_rescheduled",
                        "interview_cancelled",
                        "interview_completed",
                    )
                ),
                name="notification_type_valid",
            )
        ]
        indexes = [
            models.Index(fields=("candidate", "-created_at")),
            models.Index(fields=("candidate", "is_read", "-created_at")),
        ]

    def __str__(self):
        return f"{self.get_notification_type_display()} for candidate {self.candidate_id}"
