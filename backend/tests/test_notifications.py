from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.applications.models import Application
from apps.candidates.models import CandidateProfile
from apps.interviews.models import Interview
from apps.jobs.models import Job
from apps.notifications.models import Notification
from apps.resumes.models import Resume

User = get_user_model()


@pytest.fixture
def user(db):
    user = User.objects.create_user(username="candidate@example.com", password="test-pass")
    CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def other_user(db):
    user = User.objects.create_user(username="other@example.com", password="test-pass")
    CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def client(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


def create_job():
    return Job.objects.create(
        title="Python Developer",
        company_name="Example Company",
        description="Build APIs.",
        location="Delhi",
        employment_type="full-time",
        work_mode=Job.WorkMode.REMOTE,
        skills=["Python"],
        application_url="https://example.com/apply",
        source="fixture",
        source_job_id=uuid4().hex,
        posted_at=timezone.now(),
        expires_at=timezone.now() + timedelta(days=30),
    )


def create_resume(user):
    return Resume.objects.create(
        candidate=user.candidate_profile,
        title="Resume",
        file=f"resumes/{uuid4().hex}.pdf",
        file_name="resume.pdf",
        file_type="application/pdf",
        file_size=100,
        is_primary=True,
    )


def create_application(user):
    return Application.objects.create(
        candidate=user.candidate_profile,
        job=create_job(),
        resume=create_resume(user),
    )


def create_interview(user):
    return Interview.objects.create(
        application=create_application(user),
        round_name="Technical Interview",
        scheduled_at=timezone.now() + timedelta(days=2),
        duration_minutes=60,
        mode=Interview.Mode.ONLINE,
        meeting_link="https://meet.example.com/technical",
    )


def create_notification(user, index=1, **overrides):
    values = {
        "candidate": user.candidate_profile,
        "notification_type": Notification.Type.APPLICATION_SUBMITTED,
        "title": f"Notification {index}",
        "message": "Candidate-friendly message.",
        "event_key": f"test:{user.pk}:{index}:{uuid4().hex}",
    }
    values.update(overrides)
    return Notification.objects.create(**values)


@pytest.mark.django_db
def test_model_defaults_type_validation_and_ordering(user):
    older = create_notification(user, 1)
    newer = create_notification(user, 2)
    Notification.objects.filter(pk=older.pk).update(created_at=timezone.now() - timedelta(days=1))
    assert newer.is_read is False
    assert list(Notification.objects.values_list("id", flat=True)) == [newer.id, older.id]
    invalid = Notification(
        candidate=user.candidate_profile,
        notification_type="unknown",
        title="Invalid",
        message="Invalid",
        event_key="invalid-type",
    )
    with pytest.raises(DjangoValidationError):
        invalid.full_clean()


@pytest.mark.django_db
def test_list_is_owned_paginated_unread_and_newest_first(client, user, other_user):
    older = create_notification(user, 1)
    read = create_notification(user, 2, is_read=True)
    newest = create_notification(user, 3)
    create_notification(other_user, 4)
    Notification.objects.filter(pk=older.pk).update(created_at=timezone.now() - timedelta(days=1))
    response = client.get("/api/notifications/", {"page_size": 2})
    unread = client.get("/api/notifications/", {"unread": "true"})
    assert response.status_code == 200
    assert response.data["count"] == 3
    assert response.data["next"] is not None
    assert [item["id"] for item in response.data["results"]] == [newest.id, read.id]
    assert {item["id"] for item in unread.data["results"]} == {newest.id, older.id}
    assert client.get("/api/notifications/", {"unread": "maybe"}).status_code == 400


@pytest.mark.django_db
def test_detail_and_mark_read_are_owned_and_idempotent(client, user, other_user):
    own = create_notification(user)
    other = create_notification(other_user)
    detail = client.get(f"/api/notifications/{own.id}/")
    first = client.post(f"/api/notifications/{own.id}/read/")
    repeated = client.post(f"/api/notifications/{own.id}/read/")
    own.refresh_from_db()
    assert detail.status_code == first.status_code == repeated.status_code == 200
    assert first.data["is_read"] is repeated.data["is_read"] is True
    assert own.is_read is True
    assert "candidate" not in detail.data and "event_key" not in detail.data
    assert client.get(f"/api/notifications/{other.id}/").status_code == 404
    assert client.post(f"/api/notifications/{other.id}/read/").status_code == 404


@pytest.mark.django_db
def test_mark_all_read_only_updates_current_candidate(client, user, other_user):
    create_notification(user, 1)
    create_notification(user, 2, is_read=True)
    other = create_notification(other_user, 3)
    response = client.post("/api/notifications/read-all/")
    assert response.status_code == 200
    assert response.data == {"updated_count": 1}
    assert not Notification.objects.filter(candidate=user.candidate_profile, is_read=False).exists()
    other.refresh_from_db()
    assert other.is_read is False


@pytest.mark.django_db
def test_application_success_and_withdrawal_create_one_notification_each(client, user):
    job = create_job()
    resume = create_resume(user)
    created = client.post(
        "/api/applications/",
        {"job_id": job.id, "resume_id": resume.id},
        format="json",
    )
    application = Application.objects.get(pk=created.data["id"])
    withdrawn = client.post(f"/api/applications/{application.id}/withdraw/")
    assert created.status_code == 201 and withdrawn.status_code == 200
    assert list(
        Notification.objects.filter(application=application).values_list(
            "notification_type", flat=True
        )
    ) == [
        Notification.Type.APPLICATION_WITHDRAWN,
        Notification.Type.APPLICATION_SUBMITTED,
    ]
    assert job.title in Notification.objects.get(
        application=application,
        notification_type=Notification.Type.APPLICATION_SUBMITTED,
    ).message


@pytest.mark.django_db
def test_failed_application_operations_create_no_notifications(client, user):
    job = create_job()
    resume = create_resume(user)
    payload = {"job_id": job.id, "resume_id": resume.id}
    assert client.post("/api/applications/", payload, format="json").status_code == 201
    count = Notification.objects.count()
    assert client.post("/api/applications/", payload, format="json").status_code == 400
    application = Application.objects.get()
    assert client.post(f"/api/applications/{application.id}/withdraw/").status_code == 200
    assert client.post(f"/api/applications/{application.id}/withdraw/").status_code == 400
    assert Notification.objects.count() == count + 1


@pytest.mark.django_db
def test_interview_creation_creates_scheduled_notification(client, user):
    application = create_application(user)
    response = client.post(
        "/api/interviews/",
        {
            "application_id": application.id,
            "round_name": "Technical Interview",
            "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
            "duration_minutes": 60,
            "mode": "online",
        },
        format="json",
    )
    notification = Notification.objects.get(
        interview_id=response.data["id"],
        notification_type=Notification.Type.INTERVIEW_SCHEDULED,
    )
    assert response.status_code == 201
    assert application.job.title in notification.message
    assert notification.application == application


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("status_value", "notification_type"),
    [
        ("completed", Notification.Type.INTERVIEW_COMPLETED),
        ("cancelled", Notification.Type.INTERVIEW_CANCELLED),
        ("rescheduled", Notification.Type.INTERVIEW_RESCHEDULED),
    ],
)
def test_interview_status_events_and_failed_retry(
    client, user, status_value, notification_type
):
    interview = create_interview(user)
    payload = {"status": status_value}
    if status_value == "rescheduled":
        payload["scheduled_at"] = (timezone.now() + timedelta(days=5)).isoformat()
    response = client.post(
        f"/api/interviews/{interview.id}/status/", payload, format="json"
    )
    repeated = client.post(
        f"/api/interviews/{interview.id}/status/", payload, format="json"
    )
    assert response.status_code == 200 and repeated.status_code == 400
    assert Notification.objects.filter(
        interview=interview, notification_type=notification_type
    ).count() == 1


@pytest.mark.django_db
def test_candidate_cannot_create_notifications_or_spoof_owner(client, other_user):
    response = client.post(
        "/api/notifications/",
        {
            "candidate_id": other_user.candidate_profile.id,
            "notification_type": Notification.Type.APPLICATION_SUBMITTED,
            "title": "Spoofed",
            "message": "Spoofed",
        },
        format="json",
    )
    assert response.status_code == 405
    assert not Notification.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/notifications/"),
        ("get", "/api/notifications/1/"),
        ("post", "/api/notifications/1/read/"),
        ("post", "/api/notifications/read-all/"),
    ],
)
def test_notification_endpoints_require_authentication(method, path):
    assert getattr(APIClient(), method)(path).status_code == 401
