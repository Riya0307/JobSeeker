from celery import shared_task

from .parsing import parse_resume


@shared_task(name="resumes.parse_resume")
def parse_resume_task(resume_id: int) -> dict:
    return parse_resume(resume_id)
