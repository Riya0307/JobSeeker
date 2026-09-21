from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.jobs.models import Job

from .services import evaluate_job_alerts


ALERT_RELEVANT_JOB_FIELDS = {
    "title",
    "company_name",
    "description",
    "location",
    "employment_type",
    "work_mode",
    "experience_min",
    "experience_max",
    "salary_min",
    "salary_max",
    "skills",
    "expires_at",
    "is_active",
}


@receiver(pre_save, sender=Job)
def detect_alert_relevant_job_change(sender, instance, raw=False, update_fields=None, **kwargs):
    if raw:
        instance._evaluate_job_alerts = False
    elif instance._state.adding:
        instance._evaluate_job_alerts = True
    elif update_fields is not None:
        instance._evaluate_job_alerts = bool(ALERT_RELEVANT_JOB_FIELDS.intersection(update_fields))
    else:
        previous = sender.objects.filter(pk=instance.pk).values(*ALERT_RELEVANT_JOB_FIELDS).first()
        instance._evaluate_job_alerts = previous is None or any(
            previous[field] != getattr(instance, field) for field in ALERT_RELEVANT_JOB_FIELDS
        )


@receiver(post_save, sender=Job)
def evaluate_alerts_for_saved_job(sender, instance, created=False, raw=False, **kwargs):
    if not raw and (created or getattr(instance, "_evaluate_job_alerts", False)):
        evaluate_job_alerts(instance)
