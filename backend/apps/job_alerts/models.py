from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from apps.candidates.models import CandidateProfile
from apps.jobs.models import Job
from apps.matching.services import normalize_skill


MAX_ALERT_SKILLS = 25


class JobAlert(models.Model):
    class EmploymentType(models.TextChoices):
        FULL_TIME = "full-time", "Full-time"
        PART_TIME = "part-time", "Part-time"
        CONTRACT = "contract", "Contract"
        INTERNSHIP = "internship", "Internship"
        TEMPORARY = "temporary", "Temporary"

    candidate = models.ForeignKey(
        CandidateProfile,
        on_delete=models.CASCADE,
        related_name="job_alerts",
    )
    name = models.CharField(max_length=255, default="Job Alert")
    keywords = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    work_mode = models.CharField(
        max_length=10,
        choices=Job.WorkMode.choices,
        blank=True,
    )
    employment_type = models.CharField(
        max_length=50,
        choices=EmploymentType.choices,
        blank=True,
    )
    experience_min = models.PositiveSmallIntegerField(null=True, blank=True)
    experience_max = models.PositiveSmallIntegerField(null=True, blank=True)
    salary_min = models.PositiveBigIntegerField(null=True, blank=True)
    salary_max = models.PositiveBigIntegerField(null=True, blank=True)
    skills = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.CheckConstraint(
                condition=Q(experience_min__isnull=True)
                | Q(experience_max__isnull=True)
                | Q(experience_min__lte=F("experience_max")),
                name="job_alert_experience_range_valid",
            ),
            models.CheckConstraint(
                condition=Q(salary_min__isnull=True)
                | Q(salary_max__isnull=True)
                | Q(salary_min__lte=F("salary_max")),
                name="job_alert_salary_range_valid",
            ),
        ]
        indexes = [
            models.Index(fields=("candidate", "-created_at")),
            models.Index(fields=("candidate", "is_active")),
            models.Index(fields=("is_active", "-updated_at")),
        ]

    def clean(self):
        errors = {}
        if self.experience_min is not None and self.experience_max is not None:
            if self.experience_min > self.experience_max:
                errors["experience_max"] = "Maximum experience must be at least the minimum."
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                errors["salary_max"] = "Maximum salary must be at least the minimum."
        if not isinstance(self.skills, list) or not all(
            isinstance(skill, str) for skill in self.skills
        ):
            errors["skills"] = "Skills must be a list of strings."
        elif len(self.skills) > MAX_ALERT_SKILLS:
            errors["skills"] = f"An alert can contain at most {MAX_ALERT_SKILLS} skills."
        meaningful_skills = (
            isinstance(self.skills, list)
            and any(normalize_skill(skill) for skill in self.skills if isinstance(skill, str))
        )
        has_criteria = any(
            (
                self.keywords.strip(),
                self.location.strip(),
                self.work_mode,
                self.employment_type,
                self.experience_min is not None,
                self.experience_max is not None,
                self.salary_min is not None,
                self.salary_max is not None,
                meaningful_skills,
            )
        )
        if not has_criteria:
            errors["criteria"] = "Provide at least one job alert criterion."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.name} for {self.candidate.user.email}"
