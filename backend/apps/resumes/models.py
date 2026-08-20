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
