from datetime import timedelta
from io import StringIO
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.jobs.ingestion import execute_ingestion_run
from apps.jobs.models import IngestionRun, Job
from apps.jobs.operations import provider_health
from apps.jobs.providers.arbeitnow import BatchIngestionReport, RejectedJob


def authenticated_client(*, staff=False):
    user = get_user_model().objects.create_user(
        username=f"{'staff' if staff else 'candidate'}-{uuid4().hex}@example.com",
        password="test-password",
        is_staff=staff,
    )
    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}"
    )
    return client


def create_run(provider="arbeitnow", status=IngestionRun.Status.COMPLETED, **values):
    defaults = {
        "finished_at": timezone.now() if status != IngestionRun.Status.RUNNING else None,
        "fetched_count": 10,
        "processed_count": 10,
        "created_count": 2,
        "updated_count": 1,
        "unchanged_count": 6,
        "rejected_count": 1,
        "deactivated_count": 0,
        "rejection_reasons": {"location required": 1},
        "running_lock": provider if status == IngestionRun.Status.RUNNING else None,
    }
    defaults.update(values)
    return IngestionRun.objects.create(provider=provider, status=status, **defaults)


def create_provider_job(*, provider="arbeitnow", active=True):
    now = timezone.now()
    return Job.objects.create(
        title="Python Engineer",
        company_name="Example Ltd",
        description="Build APIs.",
        location="Remote",
        employment_type="full-time",
        work_mode=Job.WorkMode.REMOTE,
        skills=["Python"],
        application_url="https://example.com/apply",
        source=provider,
        source_job_id=uuid4().hex,
        posted_at=now,
        is_active=active,
        provider_last_seen_at=now,
    )


@pytest.mark.django_db
def test_operational_api_requires_staff_authentication():
    assert APIClient().get("/api/admin/job-ingestion/runs/").status_code == 401
    assert authenticated_client().get("/api/admin/job-ingestion/runs/").status_code == 403
    assert authenticated_client(staff=True).get(
        "/api/admin/job-ingestion/runs/"
    ).status_code == 200


@pytest.mark.django_db
def test_run_list_is_paginated_newest_first_and_filterable():
    older = create_run(provider="arbeitnow")
    newer = create_run(provider="other", status=IngestionRun.Status.FAILED)
    client = authenticated_client(staff=True)

    response = client.get("/api/admin/job-ingestion/runs/?page_size=1")
    assert response.status_code == 200
    assert response.data["count"] == 2
    assert response.data["results"][0]["id"] == newer.pk

    response = client.get(
        "/api/admin/job-ingestion/runs/?provider=arbeitnow&status=completed"
    )
    assert [item["id"] for item in response.data["results"]] == [older.pk]


@pytest.mark.django_db
def test_run_detail_exposes_operational_fields_without_lock_or_payload():
    run = create_run(error_message="normalized provider failure")
    response = authenticated_client(staff=True).get(
        f"/api/admin/job-ingestion/runs/{run.pk}/"
    )
    assert response.status_code == 200
    assert response.data["created_count"] == 2
    assert response.data["rejection_reasons"] == {"location required": 1}
    assert response.data["error_message"] == "normalized provider failure"
    assert "running_lock" not in response.data
    assert "payload" not in response.data


@pytest.mark.django_db
def test_summary_reports_latest_runs_and_provider_job_counts():
    successful = create_run()
    failed = create_run(status=IngestionRun.Status.FAILED, error_message="offline")
    create_provider_job(active=True)
    create_provider_job(active=False)

    response = authenticated_client(staff=True).get(
        "/api/admin/job-ingestion/summary/?provider=arbeitnow"
    )
    assert response.status_code == 200
    result = response.data[0]
    assert result["last_successful_run"]["id"] == successful.pk
    assert result["last_failed_run"]["id"] == failed.pk
    assert result["active_job_count"] == 1
    assert result["inactive_job_count"] == 1


@pytest.mark.django_db
def test_health_reports_explicit_never_run_recent_failed_and_running_conditions(settings):
    settings.JOB_INGESTION_HEALTH_STALE_AFTER_HOURS = 24
    assert provider_health("never")["conditions"] == ["never_succeeded"]

    create_provider_job()
    create_run(processed_count=10, rejected_count=0, rejection_reasons={})
    assert provider_health("arbeitnow")["status"] == "healthy"

    create_run(status=IngestionRun.Status.FAILED, error_message="offline")
    failed = provider_health("arbeitnow")
    assert failed["status"] == "failed"
    assert "latest_run_failed" in failed["conditions"]

    running = create_run(provider="running", status=IngestionRun.Status.RUNNING)
    result = provider_health("running")
    assert result["running"] is True
    assert "running" in result["conditions"]
    running.delete()


@pytest.mark.django_db
def test_health_detects_stale_success_high_rejections_and_zero_active_jobs(settings):
    settings.JOB_INGESTION_HEALTH_STALE_AFTER_HOURS = 1
    settings.JOB_INGESTION_HIGH_REJECTION_RATE = 0.75
    run = create_run(processed_count=4, rejected_count=3)
    old = timezone.now() - timedelta(hours=2)
    IngestionRun.objects.filter(pk=run.pk).update(finished_at=old)
    create_provider_job(active=False)

    health = provider_health("arbeitnow")
    assert health["status"] == "warning"
    assert {"last_success_stale", "high_rejection_rate", "zero_active_jobs"} <= set(
        health["conditions"]
    )
    assert health["rejection_rate"] == 0.75


@pytest.mark.django_db
def test_ingestion_persists_normalized_rejection_counts_without_raw_records():
    report = BatchIngestionReport(
        rejected=[
            RejectedJob("one", "location is required"),
            RejectedJob("two", "location is required"),
            RejectedJob("three", "unsupported employment type"),
        ]
    )
    execution = execute_ingestion_run(
        provider="metrics-provider",
        limit=3,
        fetcher=lambda limit: [{"secret": "raw"}] * 3,
        processor=lambda records, observed_at: report,
    )
    assert execution.run.rejection_reasons == {
        "location required": 2,
        "unsupported employment type": 1,
    }
    assert "raw" not in str(execution.run.rejection_reasons)


@pytest.mark.django_db
def test_operational_commands_filter_validate_and_detect_stuck_runs(settings):
    completed = create_run()
    create_run(provider="other", status=IngestionRun.Status.FAILED)
    status_output = StringIO()
    runs_output = StringIO()
    call_command("ingestion_status", provider="arbeitnow", stdout=status_output)
    call_command(
        "ingestion_runs",
        provider="arbeitnow",
        status="completed",
        limit=1,
        stdout=runs_output,
    )
    assert "Provider: arbeitnow" in status_output.getvalue()
    assert (
        f"{completed.pk} | arbeitnow | manual | completed"
        in runs_output.getvalue()
    )
    assert "other" not in runs_output.getvalue()
    with pytest.raises(CommandError, match="between 1 and 100"):
        call_command("ingestion_runs", limit=0)
    with pytest.raises(CommandError, match="status must"):
        call_command("ingestion_runs", status="invalid")

    settings.JOB_INGESTION_STUCK_AFTER_HOURS = 2
    running = create_run(provider="stuck", status=IngestionRun.Status.RUNNING)
    IngestionRun.objects.filter(pk=running.pk).update(
        started_at=timezone.now() - timedelta(hours=3)
    )
    stuck_output = StringIO()
    call_command("check_ingestion_runs", provider="stuck", stdout=stuck_output)
    assert f"run_id={running.pk}" in stuck_output.getvalue()
    assert f"recover_ingestion_run {running.pk}" in stuck_output.getvalue()
    running.refresh_from_db()
    assert running.status == IngestionRun.Status.RUNNING


@pytest.mark.django_db
def test_monitoring_is_read_only_and_does_not_bypass_snapshot_safety():
    unseen = create_provider_job()
    Job.objects.filter(pk=unseen.pk).update(
        provider_last_seen_at=timezone.now() - timedelta(days=3)
    )
    create_run()
    client = authenticated_client(staff=True)

    assert client.get("/api/admin/job-ingestion/summary/").status_code == 200
    assert client.get("/api/admin/job-ingestion/health/").status_code == 200
    unseen.refresh_from_db()
    assert unseen.is_active is True


@pytest.mark.django_db
def test_candidate_job_serializer_still_hides_provider_metadata():
    job = create_provider_job()
    response = authenticated_client().get(f"/api/jobs/{job.pk}/")
    assert response.status_code == 200
    assert {"source", "source_job_id", "provider_last_seen_at"}.isdisjoint(
        response.data
    )
