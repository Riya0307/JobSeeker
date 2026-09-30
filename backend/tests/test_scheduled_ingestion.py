from datetime import timedelta
from types import SimpleNamespace
from urllib.error import HTTPError
from uuid import uuid4

import pytest
from celery.exceptions import Retry
from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured

from apps.candidates.models import CandidateProfile
from apps.job_alerts.models import JobAlert
from apps.jobs.models import IngestionRun, Job
from apps.jobs.providers.arbeitnow import (
    ArbeitnowProviderError,
    TransientArbeitnowProviderError,
    fetch_jobs,
)
from apps.jobs.tasks import ingest_arbeitnow_task
from apps.notifications.models import Notification
from config.settings.base import build_arbeitnow_beat_schedule


def provider_record(**overrides):
    record = {
        "slug": "scheduled-python-engineer",
        "company_name": "Example Ltd",
        "title": "Python Engineer",
        "description": "<p>Build Django APIs.</p>",
        "remote": True,
        "url": "https://www.arbeitnow.com/view/scheduled-python-engineer",
        "tags": ["Python", "Django"],
        "job_types": ["Full-time"],
        "location": "Remote, Europe",
        "created_at": 1787217300,
    }
    record.update(overrides)
    return record


def task_result_run():
    return SimpleNamespace(
        pk=7,
        provider="arbeitnow",
        status=IngestionRun.Status.COMPLETED,
        fetched_count=1,
        processed_count=1,
        created_count=1,
        updated_count=0,
        unchanged_count=0,
        rejected_count=0,
        deactivated_count=0,
        rejection_reasons={},
    )


def test_beat_schedule_is_single_configurable_bounded_entry(settings):
    schedule = build_arbeitnow_beat_schedule(90, 40)
    assert list(schedule) == ["arbeitnow-bounded-ingestion"]
    assert schedule["arbeitnow-bounded-ingestion"] == {
        "task": "jobs.ingest_arbeitnow",
        "schedule": timedelta(minutes=90),
        "kwargs": {"limit": 40},
    }
    assert ingest_arbeitnow_task.max_retries == settings.JOB_INGEST_ARBEITNOW_MAX_RETRIES == 2
    with pytest.raises(ImproperlyConfigured):
        build_arbeitnow_beat_schedule(60, 101)


@pytest.mark.parametrize("status_code", [429, 500, 503])
def test_transient_http_statuses_are_classified_for_retry(monkeypatch, status_code):
    def fail(request, timeout):
        raise HTTPError(request.full_url, status_code, "temporary", {}, None)

    monkeypatch.setattr("apps.jobs.providers.arbeitnow.urlopen", fail)
    with pytest.raises(TransientArbeitnowProviderError):
        fetch_jobs(limit=1)


def test_permanent_http_error_is_not_classified_as_transient(monkeypatch):
    def fail(request, timeout):
        raise HTTPError(request.full_url, 400, "bad request", {}, None)

    monkeypatch.setattr("apps.jobs.providers.arbeitnow.urlopen", fail)
    with pytest.raises(ArbeitnowProviderError) as error:
        fetch_jobs(limit=1)
    assert not isinstance(error.value, TransientArbeitnowProviderError)


def test_scheduled_task_uses_configured_limit_and_never_requests_full_snapshot(
    settings, monkeypatch
):
    settings.JOB_INGEST_ARBEITNOW_LIMIT = 31
    captured = {}

    def fake_run(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(run=task_result_run())

    monkeypatch.setattr("apps.jobs.tasks.run_arbeitnow_ingestion", fake_run)
    result = ingest_arbeitnow_task.run()

    assert captured == {"limit": 31, "trigger": IngestionRun.Trigger.SCHEDULED}
    assert result["status"] == IngestionRun.Status.COMPLETED
    assert result["deactivated"] == 0


@pytest.mark.django_db
def test_invalid_runtime_limit_fails_before_fetch_or_run_creation(settings):
    settings.JOB_INGEST_ARBEITNOW_LIMIT = 101
    with pytest.raises(ValueError, match="between 1 and 100"):
        ingest_arbeitnow_task.run()
    assert not IngestionRun.objects.exists()


@pytest.mark.django_db
def test_transient_failure_records_failed_run_and_requests_bounded_retry(
    settings, monkeypatch
):
    settings.JOB_INGEST_ARBEITNOW_RETRY_BACKOFF_SECONDS = 30
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs",
        lambda limit: (_ for _ in ()).throw(
            TransientArbeitnowProviderError("temporary provider outage")
        ),
    )
    captured = {}

    def fake_retry(**kwargs):
        captured.update(kwargs)
        raise Retry(exc=kwargs["exc"])

    monkeypatch.setattr(ingest_arbeitnow_task, "retry", fake_retry)
    with pytest.raises(Retry):
        ingest_arbeitnow_task.run(limit=1)

    run = IngestionRun.objects.get()
    assert run.status == IngestionRun.Status.FAILED
    assert run.trigger == IngestionRun.Trigger.SCHEDULED
    assert run.running_lock is None
    assert captured["countdown"] == 30
    assert isinstance(captured["exc"], TransientArbeitnowProviderError)


@pytest.mark.django_db
def test_permanent_provider_failure_is_not_retried(monkeypatch):
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs",
        lambda limit: (_ for _ in ()).throw(ArbeitnowProviderError("invalid payload")),
    )
    monkeypatch.setattr(
        ingest_arbeitnow_task,
        "retry",
        lambda **kwargs: pytest.fail("permanent failure must not retry"),
    )
    with pytest.raises(ArbeitnowProviderError, match="invalid payload"):
        ingest_arbeitnow_task.run(limit=1)
    assert IngestionRun.objects.get().status == IngestionRun.Status.FAILED


@pytest.mark.django_db
@pytest.mark.parametrize(
    "record",
    [
        provider_record(job_types=["unsupported"]),
        provider_record(location=""),
        {"not": "a valid provider record"},
    ],
)
def test_data_quality_rejections_complete_without_retry(monkeypatch, record):
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs", lambda limit: [record]
    )
    monkeypatch.setattr(
        ingest_arbeitnow_task,
        "retry",
        lambda **kwargs: pytest.fail("record validation must not retry"),
    )
    result = ingest_arbeitnow_task.run(limit=1)
    assert result["status"] == IngestionRun.Status.COMPLETED
    assert result["rejected"] == 1


@pytest.mark.django_db
def test_scheduled_manual_overlap_uses_database_lock_and_creates_no_second_run():
    active = IngestionRun.objects.create(
        provider="arbeitnow",
        trigger=IngestionRun.Trigger.MANUAL,
        status=IngestionRun.Status.RUNNING,
        running_lock="arbeitnow",
    )
    result = ingest_arbeitnow_task.run(limit=1)
    assert result == {
        "provider": "arbeitnow",
        "status": "already_running",
        "retrying": False,
    }
    assert IngestionRun.objects.count() == 1
    active.refresh_from_db()
    assert active.status == IngestionRun.Status.RUNNING


@pytest.mark.django_db
def test_scheduled_idempotency_preserves_job_alert_deduplication(monkeypatch):
    user = get_user_model().objects.create_user(
        username=f"scheduled-{uuid4().hex}@example.com", password="test"
    )
    candidate = CandidateProfile.objects.create(user=user)
    JobAlert.objects.create(candidate=candidate, name="Python", keywords="Python")
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs",
        lambda limit: [provider_record()],
    )

    first = ingest_arbeitnow_task.run(limit=1)
    second = ingest_arbeitnow_task.run(limit=1)

    assert first["created"] == 1
    assert second["unchanged"] == 1
    assert Job.objects.filter(
        source="arbeitnow", source_job_id="scheduled-python-engineer"
    ).count() == 1
    assert Notification.objects.filter(
        candidate=candidate, notification_type="job_alert_match"
    ).count() == 1
    assert not IngestionRun.objects.filter(full_snapshot=True).exists()
