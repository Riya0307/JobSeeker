from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile
from apps.job_alerts.models import JobAlert
from apps.jobs.models import Job
from apps.jobs.services import IngestionStatus, ingest_job
from apps.matching.services import calculate_match
from apps.notifications.models import Notification


def valid_payload(**overrides):
    payload = {
        "title": "Python Platform Engineer",
        "company_name": "Example Technologies",
        "description": "Build reliable Django APIs.",
        "location": "Bangalore",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.REMOTE,
        "experience_min": 2,
        "experience_max": 5,
        "salary_min": 800000,
        "salary_max": 1400000,
        "skills": [" Python ", "PYTHON", "REST-API", "REST API", "---"],
        "application_url": "https://example.com/jobs/python-platform",
        "posted_at": timezone.now(),
        "expires_at": timezone.now() + timedelta(days=30),
        "is_active": True,
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_ingestion_creates_normalized_job_and_hides_source_metadata(client):
    result = ingest_job(" provider ", " external-1 ", valid_payload())

    assert result.status == IngestionStatus.CREATED
    assert result.job.source == "provider"
    assert result.job.source_job_id == "external-1"
    assert result.job.skills == ["Python", "REST-API"]
    response = client.get(f"/api/jobs/{result.job.id}/")
    assert response.status_code == 200
    assert "source" not in response.data
    assert "source_job_id" not in response.data


@pytest.mark.django_db
def test_repeated_ingestion_is_idempotent_and_valid_changes_update():
    payload = valid_payload()
    created = ingest_job("provider", "same-id", payload)
    unchanged = ingest_job("provider", "same-id", payload)
    updated = ingest_job("provider", "same-id", {"title": "Principal Python Engineer"})

    assert created.status == IngestionStatus.CREATED
    assert unchanged.status == IngestionStatus.UNCHANGED
    assert updated.status == IngestionStatus.UPDATED
    assert updated.job.title == "Principal Python Engineer"
    assert Job.objects.filter(source="provider", source_job_id="same-id").count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "payload",
    [
        {},
        valid_payload(title="   "),
        valid_payload(salary_min=-1),
        valid_payload(salary_min=2000000, salary_max=1000000),
        valid_payload(experience_min=-1),
        valid_payload(experience_min=8, experience_max=2),
        valid_payload(work_mode="virtual"),
        valid_payload(employment_type="permanent"),
        valid_payload(application_url="not a URL"),
        valid_payload(skills={"Python": True}),
    ],
)
def test_ingestion_rejects_invalid_jobs_without_persisting(payload):
    with pytest.raises(ValidationError):
        ingest_job("provider", uuid4().hex, payload)
    assert Job.objects.count() == 0


@pytest.mark.django_db
def test_failed_update_preserves_existing_valid_job():
    job = ingest_job("provider", "stable-id", valid_payload()).job

    with pytest.raises(ValidationError):
        ingest_job("provider", "stable-id", {"salary_min": 2000000, "salary_max": 1})

    job.refresh_from_db()
    assert job.salary_min == 800000
    assert job.salary_max == 1400000


@pytest.mark.django_db
def test_ingested_job_uses_existing_eligibility_and_matching_rules(client, user):
    available = ingest_job("provider", "available", valid_payload()).job
    expired = ingest_job(
        "provider",
        "expired",
        valid_payload(expires_at=timezone.now() - timedelta(seconds=1)),
    ).job
    profile = user.candidate_profile
    profile.location = "Bangalore"
    profile.years_of_experience = 3
    profile.skills = ["Python", "REST API"]

    response = client.get("/api/jobs/")
    assert [item["id"] for item in response.data["results"]] == [available.id]
    assert client.get(f"/api/jobs/{expired.id}/").status_code == 404
    assert calculate_match(profile, available).matched_skills == ["Python", "REST-API"]


@pytest.mark.django_db
def test_ingestion_triggers_alert_once_and_unchanged_reingestion_is_a_noop(user):
    JobAlert.objects.create(
        candidate=user.candidate_profile,
        name="Python jobs",
        keywords="Python",
    )
    payload = valid_payload()

    first = ingest_job("provider", "alerted", payload)
    second = ingest_job("provider", "alerted", payload)

    notifications = Notification.objects.filter(
        candidate=user.candidate_profile,
        notification_type=Notification.Type.JOB_ALERT_MATCH,
        job=first.job,
    )
    assert first.status == IngestionStatus.CREATED
    assert second.status == IngestionStatus.UNCHANGED
    assert notifications.count() == 1


@pytest.mark.django_db
def test_ingestion_rejects_identity_and_server_controlled_payload_fields():
    with pytest.raises(ValidationError):
        ingest_job(" ", "id", valid_payload())
    with pytest.raises(ValidationError):
        ingest_job("provider", " ", valid_payload())
    with pytest.raises(ValidationError):
        ingest_job("provider", "id", {**valid_payload(), "created_at": timezone.now()})
    assert Job.objects.count() == 0


@pytest.fixture
def user(db):
    user_model = get_user_model()
    user = user_model.objects.create_user(username="ingestion@example.com", password="test-pass")
    CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def client(user):
    api_client = APIClient()
    token = RefreshToken.for_user(user).access_token
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return api_client
