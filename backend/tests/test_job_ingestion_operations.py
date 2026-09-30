from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile
from apps.job_alerts.models import JobAlert
from apps.jobs.ingestion import (
    FullSnapshotNotVerified,
    IngestionAlreadyRunning,
    deactivate_stale_provider_jobs,
    execute_ingestion_run,
    run_arbeitnow_ingestion,
)
from apps.jobs.models import IngestionRun, Job, SavedJob
from apps.jobs.providers.arbeitnow import BatchIngestionReport, ingest_records
from apps.jobs.providers.arbeitnow import ArbeitnowProviderError
from apps.jobs.services import ingest_job
from apps.jobs.tasks import ingest_arbeitnow_task
from apps.notifications.models import Notification


def provider_record(**overrides):
    record = {
        "slug": "python-engineer-123",
        "company_name": "Example Ltd",
        "title": "Python Engineer",
        "description": "<p>Build Django APIs.</p>",
        "remote": True,
        "url": "https://www.arbeitnow.com/view/python-engineer-123",
        "tags": ["Python", "Django"],
        "job_types": ["Full-time"],
        "location": "Remote, Europe",
        "created_at": 1787217300,
    }
    record.update(overrides)
    return record


def job_payload(**overrides):
    payload = {
        "title": "Python Engineer",
        "company_name": "Example Ltd",
        "description": "Build Django APIs.",
        "location": "Remote",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.REMOTE,
        "experience_min": None,
        "experience_max": None,
        "salary_min": None,
        "salary_max": None,
        "skills": ["Python"],
        "application_url": "https://example.com/apply",
        "posted_at": timezone.now(),
        "expires_at": None,
        "is_active": True,
    }
    payload.update(overrides)
    return payload


def create_job(source="fixture", **overrides):
    values = {
        **job_payload(),
        "source": source,
        "source_job_id": uuid4().hex,
    }
    values.update(overrides)
    return Job.objects.create(**values)


@pytest.mark.django_db
def test_task_records_created_rejected_unchanged_and_updated_counts(monkeypatch):
    records = [provider_record(), provider_record(slug="bad", job_types=[])]
    monkeypatch.setattr("apps.jobs.providers.arbeitnow.fetch_jobs", lambda limit: records)

    first = ingest_arbeitnow_task.run(limit=2)
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs", lambda limit: [provider_record()]
    )
    second = ingest_arbeitnow_task.run(limit=1)
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs",
        lambda limit: [provider_record(title="Senior Python Engineer")],
    )
    third = ingest_arbeitnow_task.run(limit=1)

    assert (first["created"], first["rejected"]) == (1, 1)
    assert second["unchanged"] == 1
    assert third["updated"] == 1
    assert Job.objects.filter(source="arbeitnow", source_job_id="python-engineer-123").count() == 1
    assert IngestionRun.objects.filter(status=IngestionRun.Status.COMPLETED).count() == 3
    assert not IngestionRun.objects.exclude(
        trigger=IngestionRun.Trigger.SCHEDULED
    ).exists()


@pytest.mark.django_db
def test_failed_task_records_failure_and_rolls_back_jobs_and_alerts(monkeypatch):
    user = get_user_model().objects.create_user(username="alerts@example.com", password="test")
    profile = CandidateProfile.objects.create(user=user)
    stale = create_job(
        source="arbeitnow-failure-test",
        provider_last_seen_at=timezone.now() - timedelta(days=3),
    )
    JobAlert.objects.create(candidate=profile, name="Python", keywords="Python")
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs", lambda limit: [provider_record()]
    )

    def fail_after_write(records, observed_at):
        ingest_records(records, observed_at=observed_at)
        raise RuntimeError("provider processing failed")

    with pytest.raises(RuntimeError):
        execute_ingestion_run(
            provider="arbeitnow-failure-test",
            limit=1,
            fetcher=lambda limit: [provider_record()],
            processor=fail_after_write,
        )

    run = IngestionRun.objects.get(provider="arbeitnow-failure-test")
    assert run.status == IngestionRun.Status.FAILED
    assert run.finished_at is not None
    assert "provider processing failed" in run.error_message
    assert not Job.objects.filter(source="arbeitnow", source_job_id="python-engineer-123").exists()
    assert Notification.objects.count() == 0
    stale.refresh_from_db()
    assert stale.is_active is True


@pytest.mark.django_db
def test_provider_last_seen_is_set_and_advances_without_alert_duplication():
    first_seen = timezone.now() - timedelta(hours=1)
    second_seen = timezone.now()

    first = ingest_records([provider_record()], observed_at=first_seen)
    second = ingest_records([provider_record()], observed_at=second_seen)
    job = Job.objects.get(source="arbeitnow", source_job_id="python-engineer-123")
    manual = create_job()

    assert first.created == 1
    assert second.unchanged == 1
    assert job.provider_last_seen_at == second_seen
    assert manual.provider_last_seen_at is None
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_bounded_run_never_deactivates_unseen_provider_jobs(monkeypatch):
    old = create_job(
        source="arbeitnow",
        source_job_id="unseen",
        provider_last_seen_at=timezone.now() - timedelta(days=3),
    )
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs", lambda limit: [provider_record()]
    )

    execution = run_arbeitnow_ingestion(limit=1)

    old.refresh_from_db()
    assert old.is_active is True
    assert execution.run.full_snapshot is False
    assert execution.run.deactivated_count == 0


@pytest.mark.django_db
def test_verified_full_snapshot_deactivates_only_stale_scoped_jobs(settings):
    settings.JOB_PROVIDER_STALE_GRACE_HOURS = 24
    now = timezone.now()
    stale = create_job(
        source="snapshot-provider",
        source_job_id="stale",
        provider_last_seen_at=now - timedelta(days=2),
    )
    within_grace = create_job(
        source="snapshot-provider",
        source_job_id="recent",
        provider_last_seen_at=now - timedelta(hours=12),
    )
    inactive = create_job(
        source="snapshot-provider",
        source_job_id="inactive",
        provider_last_seen_at=now - timedelta(days=2),
        is_active=False,
    )
    other = create_job(
        source="other-provider",
        provider_last_seen_at=now - timedelta(days=2),
    )
    manual = create_job(provider_last_seen_at=None)
    owner = get_user_model().objects.create_user(username="saved@example.com", password="test")
    profile = CandidateProfile.objects.create(user=owner)
    SavedJob.objects.create(candidate=profile, job=stale)

    execution = execute_ingestion_run(
        provider="snapshot-provider",
        limit=1,
        fetcher=lambda limit: [],
        processor=lambda records, observed_at: BatchIngestionReport(),
        full_snapshot=True,
        snapshot_complete=True,
    )

    for job in (stale, within_grace, inactive, other, manual):
        job.refresh_from_db()
    assert stale.is_active is False
    assert within_grace.is_active is True
    assert inactive.is_active is False
    assert other.is_active is True
    assert manual.is_active is True
    assert SavedJob.objects.filter(candidate=profile, job=stale).exists()
    assert execution.run.deactivated_count == 1
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_unverified_and_arbeitnow_full_snapshots_are_refused():
    with pytest.raises(FullSnapshotNotVerified):
        execute_ingestion_run(
            provider="partial",
            limit=1,
            fetcher=lambda limit: [],
            processor=lambda records, observed_at: BatchIngestionReport(),
            full_snapshot=True,
            snapshot_complete=False,
        )
    with pytest.raises(FullSnapshotNotVerified):
        run_arbeitnow_ingestion(limit=1, full_snapshot=True)
    assert IngestionRun.objects.count() == 0


@pytest.mark.django_db
def test_database_running_lock_prevents_overlapping_provider_runs(monkeypatch):
    active = IngestionRun.objects.create(
        provider="arbeitnow",
        status=IngestionRun.Status.RUNNING,
        running_lock="arbeitnow",
    )
    monkeypatch.setattr("apps.jobs.providers.arbeitnow.fetch_jobs", lambda limit: [])

    with pytest.raises(IngestionAlreadyRunning):
        run_arbeitnow_ingestion(limit=1)

    active.refresh_from_db()
    assert active.status == IngestionRun.Status.RUNNING
    assert IngestionRun.objects.count() == 1


@pytest.mark.django_db
def test_explicit_recovery_releases_only_a_running_lock():
    active = IngestionRun.objects.create(
        provider="arbeitnow",
        status=IngestionRun.Status.RUNNING,
        running_lock="arbeitnow",
    )

    call_command("recover_ingestion_run", active.pk)

    active.refresh_from_db()
    assert active.status == IngestionRun.Status.FAILED
    assert active.finished_at is not None
    assert active.running_lock is None
    assert "interrupted worker" in active.error_message
    with pytest.raises(CommandError, match="Only an active"):
        call_command("recover_ingestion_run", active.pk)


@pytest.mark.django_db
def test_candidate_api_exposes_neither_ingestion_runs_nor_provider_metadata():
    user = get_user_model().objects.create_user(username="candidate@example.com", password="test")
    CandidateProfile.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    job = create_job(
        source="arbeitnow",
        provider_last_seen_at=timezone.now(),
    )
    IngestionRun.objects.create(
        provider="arbeitnow",
        status=IngestionRun.Status.COMPLETED,
    )

    detail = client.get(f"/api/jobs/{job.pk}/")

    assert detail.status_code == 200
    assert "source" not in detail.data
    assert "source_job_id" not in detail.data
    assert "provider_last_seen_at" not in detail.data
    assert client.get("/api/ingestion-runs/").status_code == 404


@pytest.mark.django_db
def test_command_reports_run_and_rejects_full_snapshot(monkeypatch):
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.fetch_jobs", lambda limit: [provider_record()]
    )
    output = __import__("io").StringIO()

    call_command("ingest_arbeitnow", limit=1, stdout=output)

    text = output.getvalue()
    assert "run_id=" in text
    assert "provider=arbeitnow" in text
    assert "deactivated=0" in text
    assert "status=completed" in text
    with pytest.raises(CommandError, match="complete-snapshot"):
        call_command("ingest_arbeitnow", full_snapshot=True)


@pytest.mark.django_db
def test_command_failure_is_recorded_and_reported(monkeypatch):
    def fail_fetch(limit):
        raise ArbeitnowProviderError("provider unavailable")

    monkeypatch.setattr("apps.jobs.providers.arbeitnow.fetch_jobs", fail_fetch)

    with pytest.raises(CommandError, match="provider unavailable"):
        call_command("ingest_arbeitnow", limit=1)

    run = IngestionRun.objects.get(provider="arbeitnow")
    assert run.status == IngestionRun.Status.FAILED
    assert run.running_lock is None
    assert "provider unavailable" in run.error_message
    assert run.trigger == IngestionRun.Trigger.MANUAL


def test_celery_task_is_discoverable_with_one_bounded_beat_schedule(settings):
    from config.celery import app

    app.autodiscover_tasks(force=True)

    assert "jobs.ingest_arbeitnow" in app.tasks
    assert list(settings.CELERY_BEAT_SCHEDULE) == ["arbeitnow-bounded-ingestion"]
    entry = settings.CELERY_BEAT_SCHEDULE["arbeitnow-bounded-ingestion"]
    assert entry["task"] == "jobs.ingest_arbeitnow"
    assert entry["kwargs"] == {"limit": settings.JOB_INGEST_ARBEITNOW_LIMIT}
