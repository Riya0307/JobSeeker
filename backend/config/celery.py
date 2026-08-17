import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

app = Celery("jobseeker")
app.config_from_object("django.conf:settings", namespace="CELERY")
import config.tasks  # noqa: F401
