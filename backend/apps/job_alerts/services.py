from django.db.models import Q
from django.utils import timezone

from apps.jobs.models import Job
from apps.matching.services import normalize_skill
from apps.notifications.services import create_job_alert_notification

from .models import JobAlert


def normalize_text(value):
    return " ".join(value.casefold().split()) if isinstance(value, str) else ""


def _ranges_overlap(alert_min, alert_max, job_min, job_max):
    if alert_min is not None and job_max is not None and job_max < alert_min:
        return False
    if alert_max is not None and job_min is not None and job_min > alert_max:
        return False
    return True


def job_matches_alert(alert: JobAlert, job: Job) -> bool:
    """Return true only when every populated alert criterion matches the job."""
    if not job.is_active or (job.expires_at is not None and job.expires_at <= timezone.now()):
        return False
    keyword = normalize_text(alert.keywords)
    if keyword:
        searchable_fields = [job.title, job.company_name, job.description, job.location]
        if isinstance(job.skills, list):
            searchable_fields.extend(
                skill for skill in job.skills if isinstance(skill, str)
            )
        if not any(keyword in normalize_text(value) for value in searchable_fields):
            return False
    if alert.location and normalize_text(alert.location) not in normalize_text(job.location):
        return False
    if alert.work_mode and alert.work_mode.casefold() != job.work_mode.casefold():
        return False
    if alert.employment_type and alert.employment_type.casefold() != job.employment_type.casefold():
        return False
    if (alert.experience_min is not None or alert.experience_max is not None) and not _ranges_overlap(
        alert.experience_min,
        alert.experience_max,
        job.experience_min,
        job.experience_max,
    ):
        return False
    if alert.salary_min is not None or alert.salary_max is not None:
        # An alert requesting salary information cannot match a job that omits
        # both salary bounds; otherwise the normal overlap rules apply.
        if job.salary_min is None and job.salary_max is None:
            return False
        if not _ranges_overlap(
            alert.salary_min,
            alert.salary_max,
            job.salary_min,
            job.salary_max,
        ):
            return False
    required_skills = {normalize_skill(skill) for skill in alert.skills if normalize_skill(skill)}
    stored_job_skills = job.skills if isinstance(job.skills, list) else []
    job_skills = {
        normalize_skill(skill)
        for skill in stored_job_skills
        if isinstance(skill, str) and normalize_skill(skill)
    }
    return required_skills.issubset(job_skills)


def evaluate_job_alerts(job: Job) -> int:
    """Synchronously evaluate one eligible job against narrowed active alerts."""
    if not job.is_active or (job.expires_at is not None and job.expires_at <= timezone.now()):
        return 0
    now = timezone.now()
    active_alerts = JobAlert.objects.filter(is_active=True)
    active_alerts.update(last_checked_at=now)
    alerts = active_alerts.select_related("candidate", "candidate__user")
    alerts = alerts.filter(Q(work_mode="") | Q(work_mode=job.work_mode))
    alerts = alerts.filter(Q(employment_type="") | Q(employment_type__iexact=job.employment_type))
    if job.experience_max is not None:
        alerts = alerts.filter(Q(experience_min__isnull=True) | Q(experience_min__lte=job.experience_max))
    if job.experience_min is not None:
        alerts = alerts.filter(Q(experience_max__isnull=True) | Q(experience_max__gte=job.experience_min))
    if job.salary_min is None and job.salary_max is None:
        alerts = alerts.filter(salary_min__isnull=True, salary_max__isnull=True)
    else:
        if job.salary_max is not None:
            alerts = alerts.filter(Q(salary_min__isnull=True) | Q(salary_min__lte=job.salary_max))
        if job.salary_min is not None:
            alerts = alerts.filter(Q(salary_max__isnull=True) | Q(salary_max__gte=job.salary_min))
    created_count = 0
    for alert in alerts.iterator(chunk_size=200):
        if job_matches_alert(alert, job):
            _, created = create_job_alert_notification(alert, job)
            created_count += int(created)
    return created_count
