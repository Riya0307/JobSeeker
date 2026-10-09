from pathlib import Path
from uuid import uuid4

from django.db import models

from apps.candidates.models import CandidateProfile


def resume_upload_path(instance, filename):
    """Keep user-supplied names out of storage paths while retaining the extension."""
    extension = Path(filename).suffix.lower()
    return f"resumes/{instance.candidate_id}/{uuid4().hex}{extension}"


class Resume(models.Model):
    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name="resumes",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to=resume_upload_path)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=100)
    file_size = models.PositiveBigIntegerField()
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-id")

    def __str__(self):
        return self.title


class ResumeParsedData(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    resume = models.OneToOneField(
        Resume,
        on_delete=models.CASCADE,
        related_name="parsed_data",
    )
    parser_version = models.CharField(max_length=50)
    file_hash = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    extracted_text = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True)
    job_titles = models.JSONField(default=list, blank=True)
    companies = models.JSONField(default=list, blank=True)
    employment_history = models.JSONField(default=list, blank=True)
    education = models.JSONField(default=list, blank=True)
    projects = models.JSONField(default=list, blank=True)
    certifications = models.JSONField(default=list, blank=True)
    estimated_experience_months = models.PositiveIntegerField(null=True, blank=True)
    parsing_error = models.CharField(max_length=1000, blank=True)
    extracted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-id")

    def __str__(self):
        return f"Parsed data for resume {self.resume_id} ({self.status})"
