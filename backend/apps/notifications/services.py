from django.utils import timezone

from apps.applications.models import Application
from apps.interviews.models import Interview

from .models import Notification


def create_application_notification(application: Application, notification_type: str):
    content = {
        Notification.Type.APPLICATION_SUBMITTED: (
            "Application submitted",
            f"Your application for {application.job.title} at {application.job.company_name} has been submitted.",
            "submitted",
        ),
        Notification.Type.APPLICATION_WITHDRAWN: (
            "Application withdrawn",
            f"Your application for {application.job.title} at {application.job.company_name} has been withdrawn.",
            "withdrawn",
        ),
    }
    title, message, event = content[notification_type]
    return Notification.objects.get_or_create(
        event_key=f"application:{application.pk}:{event}",
        defaults={
            "candidate": application.candidate,
            "application": application,
            "notification_type": notification_type,
            "title": title,
            "message": message,
        },
    )[0]


def create_interview_notification(interview: Interview, notification_type: str):
    job_title = interview.application.job.title
    if notification_type == Notification.Type.INTERVIEW_SCHEDULED:
        scheduled_at = timezone.localtime(interview.scheduled_at)
        title = "Interview scheduled"
        message = (
            f"Your {interview.round_name} for {job_title} is scheduled for "
            f"{scheduled_at.strftime('%d %B %Y at %I:%M %p')}."
        )
        event = "scheduled"
    else:
        content = {
            Notification.Type.INTERVIEW_RESCHEDULED: (
                "Interview rescheduled",
                f"Your {interview.round_name} for {job_title} has been rescheduled.",
                f"rescheduled:{interview.scheduled_at.isoformat()}",
            ),
            Notification.Type.INTERVIEW_CANCELLED: (
                "Interview cancelled",
                f"Your {interview.round_name} for {job_title} has been cancelled.",
                "cancelled",
            ),
            Notification.Type.INTERVIEW_COMPLETED: (
                "Interview completed",
                f"Your {interview.round_name} for {job_title} has been marked completed.",
                "completed",
            ),
        }
        title, message, event = content[notification_type]
    return Notification.objects.get_or_create(
        event_key=f"interview:{interview.pk}:{event}",
        defaults={
            "candidate": interview.application.candidate,
            "application": interview.application,
            "interview": interview,
            "notification_type": notification_type,
            "title": title,
            "message": message,
        },
    )[0]
