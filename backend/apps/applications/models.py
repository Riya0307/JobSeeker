from django.db import models

from apps.candidates.models import CandidateProfile
from apps.jobs.models import Job
from apps.resumes.models import Resume


class Application(models.Model):
    class Status(models.TextChoices):
        APPLIED = "applied", "Applied"
        UNDER_REVIEW = "under_review", "Under review"
        SHORTLISTED = "shortlisted", "Shortlisted"
        INTERVIEW = "interview", "Interview"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"

    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    job = models.ForeignKey(Job, on_delete=models.PROTECT, related_name="applications")
    resume = models.ForeignKey(Resume, on_delete=models.PROTECT, related_name="applications")
    cover_letter = models.TextField(blank=True, max_length=10000)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPLIED)
    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-applied_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("candidate", "job"),
                name="unique_candidate_job_application",
            )
        ]
        indexes = [
            models.Index(fields=("candidate", "-applied_at")),
            models.Index(fields=("status",)),
        ]

    def __str__(self):
        return f"{self.candidate_id} applied to {self.job_id}"
