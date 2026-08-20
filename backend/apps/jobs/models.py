from django.db import models
from django.db.models import F, Q

from apps.candidates.models import CandidateProfile


class Job(models.Model):
    class WorkMode(models.TextChoices):
        ONSITE = "onsite", "On-site"
        HYBRID = "hybrid", "Hybrid"
        REMOTE = "remote", "Remote"

    title = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255)
    employment_type = models.CharField(max_length=50)
    work_mode = models.CharField(max_length=10, choices=WorkMode.choices)
    experience_min = models.PositiveSmallIntegerField(null=True, blank=True)
    experience_max = models.PositiveSmallIntegerField(null=True, blank=True)
    salary_min = models.PositiveBigIntegerField(null=True, blank=True)
    salary_max = models.PositiveBigIntegerField(null=True, blank=True)
    skills = models.JSONField(default=list, blank=True)
    application_url = models.URLField(max_length=1000)
    source = models.CharField(max_length=100)
    source_job_id = models.CharField(max_length=255)
    posted_at = models.DateTimeField()
    expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-posted_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("source", "source_job_id"), name="unique_job_per_source"
            ),
            models.CheckConstraint(
                condition=Q(experience_max__isnull=True)
                | Q(experience_min__isnull=True)
                | Q(experience_max__gte=F("experience_min")),
                name="job_experience_range_valid",
            ),
            models.CheckConstraint(
                condition=Q(salary_max__isnull=True)
                | Q(salary_min__isnull=True)
                | Q(salary_max__gte=F("salary_min")),
                name="job_salary_range_valid",
            ),
        ]
        indexes = [
            models.Index(fields=("is_active", "-posted_at")),
            models.Index(fields=("work_mode",)),
            models.Index(fields=("employment_type",)),
        ]

    def __str__(self):
        return f"{self.title} at {self.company_name}"


class SavedJob(models.Model):
    candidate = models.ForeignKey(
        CandidateProfile, on_delete=models.CASCADE, related_name="saved_jobs"
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="saved_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("candidate", "job"), name="unique_candidate_saved_job"
            )
        ]

    def __str__(self):
        return f"{self.candidate_id} saved job {self.job_id}"
