from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from apps.candidates.models import CandidateProfile

from .normalization import normalize_job_skills


EMPLOYMENT_TYPES = {"full-time", "part-time", "contract", "internship", "temporary"}


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
    provider_last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
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

    def clean(self):
        super().clean()
        errors = {}
        for field_name in (
            "title",
            "company_name",
            "description",
            "location",
            "employment_type",
            "application_url",
            "source",
            "source_job_id",
        ):
            value = getattr(self, field_name)
            if isinstance(value, str) and not value.strip():
                errors[field_name] = "This field cannot be blank or whitespace only."

        if isinstance(self.employment_type, str) and self.employment_type.casefold() not in EMPLOYMENT_TYPES:
            errors["employment_type"] = "Select a supported employment type."
        try:
            self.skills = normalize_job_skills(self.skills)
        except ValidationError as error:
            errors["skills"] = error.messages
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        # Jobs enter through trusted backend/admin/seed paths rather than a
        # candidate write API. Validate that boundary for every normal save.
        self.full_clean()
        return super().save(*args, **kwargs)


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


class IngestionRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    provider = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RUNNING)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    full_snapshot = models.BooleanField(default=False)
    fetched_count = models.PositiveIntegerField(default=0)
    processed_count = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    unchanged_count = models.PositiveIntegerField(default=0)
    rejected_count = models.PositiveIntegerField(default=0)
    deactivated_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    # A running row holds the provider name here. Completed/failed rows release
    # it to NULL, while database uniqueness prevents overlapping runs.
    running_lock = models.CharField(max_length=100, null=True, blank=True, unique=True)

    class Meta:
        ordering = ("-started_at", "-id")
        indexes = [
            models.Index(fields=("provider", "-started_at")),
            models.Index(fields=("provider", "status")),
        ]

    def __str__(self):
        return f"{self.provider} ingestion #{self.pk} ({self.status})"
