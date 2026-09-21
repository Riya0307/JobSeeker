from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile
from apps.job_alerts.models import JobAlert
from apps.job_alerts.serializers import MAX_ACTIVE_ALERTS
from apps.job_alerts.services import evaluate_job_alerts, job_matches_alert
from apps.jobs.models import Job
from apps.notifications.models import Notification

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


def create_job(**overrides):
    values = {
        "title": "Senior Python Developer",
        "company_name": "Example Technologies",
        "description": "Build Django REST APIs.",
        "location": "Bangalore, India",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.REMOTE,
        "experience_min": 3,
        "experience_max": 6,
        "salary_min": 900000,
        "salary_max": 1500000,
        "skills": ["Python", "Django", "REST API"],
        "application_url": "https://example.com/apply",
        "source": "fixture",
        "source_job_id": uuid4().hex,
        "posted_at": timezone.now(),
        "expires_at": timezone.now() + timedelta(days=30),
        "is_active": True,
    }
    values.update(overrides)
    return Job.objects.create(**values)


def create_alert(user, **overrides):
    values = {
        "candidate": user.candidate_profile,
        "name": "Python Backend Jobs",
        "keywords": "Python",
    }
    values.update(overrides)
    return JobAlert.objects.create(**values)


@pytest.mark.django_db
def test_model_defaults_timestamps_and_validation(user):
    alert = create_alert(user)
    assert alert.is_active is True
    assert alert.created_at is not None and alert.updated_at is not None
    assert alert.last_checked_at is None
    alert.full_clean()
    empty = JobAlert(candidate=user.candidate_profile)
    invalid_range = JobAlert(
        candidate=user.candidate_profile,
        keywords="Python",
        experience_min=5,
        experience_max=2,
    )
    with pytest.raises(DjangoValidationError):
        empty.full_clean()
    with pytest.raises(DjangoValidationError):
        invalid_range.full_clean()
    punctuation_only = JobAlert(
        candidate=user.candidate_profile,
        skills=["---"],
    )
    with pytest.raises(DjangoValidationError):
        punctuation_only.full_clean()


@pytest.mark.django_db
def test_create_normalizes_values_and_uses_authenticated_candidate(client, user):
    response = client.post(
        "/api/job-alerts/",
        {
            "name": "  Backend roles  ",
            "keywords": "  Python   Developer ",
            "location": "  Bangalore   India ",
            "skills": [" Python ", "REST   API", "python"],
        },
        format="json",
    )
    assert response.status_code == 201
    alert = JobAlert.objects.get()
    assert alert.candidate == user.candidate_profile
    assert alert.name == "Backend roles"
    assert alert.keywords == "Python Developer"
    assert alert.location == "Bangalore India"
    assert alert.skills == ["Python", "REST API"]


@pytest.mark.django_db
def test_empty_invalid_ranges_choices_and_skills_are_rejected(client):
    assert client.post("/api/job-alerts/", {}, format="json").status_code == 400
    assert client.post(
        "/api/job-alerts/", {"experience_min": -1}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"salary_min": -1}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/",
        {"keywords": "Python", "experience_min": 5, "experience_max": 2},
        format="json",
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/",
        {"keywords": "Python", "salary_min": 100, "salary_max": 50},
        format="json",
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"work_mode": "virtual"}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"employment_type": "permanent"}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"skills": "Python"}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"skills": ["---"]}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"skills": [f"Skill {index}" for index in range(26)]}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"keywords": "x" * 256}, format="json"
    ).status_code == 400
    assert client.post(
        "/api/job-alerts/", {"location": "x" * 256}, format="json"
    ).status_code == 400


@pytest.mark.django_db
def test_crud_toggle_pagination_and_ownership(client, user, other_user):
    own = create_alert(user)
    other = create_alert(other_user, keywords="Java")
    for index in range(10):
        create_alert(user, name=f"Inactive {index}", keywords=f"Skill {index}", is_active=False)
    listing = client.get("/api/job-alerts/", {"page_size": 5})
    detail = client.get(f"/api/job-alerts/{own.id}/")
    updated = client.patch(
        f"/api/job-alerts/{own.id}/", {"location": "Delhi"}, format="json"
    )
    toggled = client.post(f"/api/job-alerts/{own.id}/toggle/")
    assert listing.status_code == 200 and listing.data["count"] == 11
    assert listing.data["next"] is not None
    assert detail.status_code == updated.status_code == toggled.status_code == 200
    assert updated.data["location"] == "Delhi"
    assert toggled.data["is_active"] is False
    assert client.get(f"/api/job-alerts/{other.id}/").status_code == 404
    assert client.patch(f"/api/job-alerts/{other.id}/", {"name": "No"}).status_code == 404
    assert client.post(f"/api/job-alerts/{other.id}/toggle/").status_code == 404
    assert client.delete(f"/api/job-alerts/{other.id}/").status_code == 404
    assert client.delete(f"/api/job-alerts/{own.id}/").status_code == 204
    assert not JobAlert.objects.filter(pk=own.pk).exists()


@pytest.mark.django_db
def test_patch_cannot_empty_alert_or_change_server_fields(client, user, other_user):
    alert = create_alert(user)
    assert client.patch(
        f"/api/job-alerts/{alert.id}/", {"keywords": ""}, format="json"
    ).status_code == 400
    for field, value in (
        ("candidate_id", other_user.candidate_profile.id),
        ("user_id", other_user.id),
        ("last_checked_at", timezone.now().isoformat()),
        ("created_at", timezone.now().isoformat()),
    ):
        response = client.patch(
            f"/api/job-alerts/{alert.id}/", {field: value}, format="json"
        )
        assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("criteria", "job_overrides"),
    [
        ({"keywords": "django rest"}, {}),
        ({"keywords": "example technologies"}, {}),
        ({"location": "bangalore"}, {}),
        ({"work_mode": "remote"}, {}),
        ({"employment_type": "full-time"}, {}),
        ({"experience_min": 4, "experience_max": 7}, {}),
        ({"salary_min": 1000000, "salary_max": 1600000}, {}),
        ({"skills": [" python ", "rest-api"]}, {}),
    ],
)
def test_each_supported_criterion_matches(user, criteria, job_overrides):
    job = create_job(**job_overrides)
    alert_values = {"keywords": ""}
    alert_values.update(criteria)
    alert = create_alert(user, **alert_values)
    assert job_matches_alert(alert, job) is True


@pytest.mark.django_db
def test_all_specified_criteria_must_match_and_unspecified_do_not_restrict(user):
    job = create_job()
    flexible = create_alert(user, keywords="Python")
    strict = create_alert(user, keywords="Python", location="Mumbai")
    assert job_matches_alert(flexible, job) is True
    assert job_matches_alert(strict, job) is False


@pytest.mark.django_db
def test_salary_requirement_rejects_missing_salary(user):
    job = create_job(salary_min=None, salary_max=None)
    alert = create_alert(user, keywords="", salary_min=800000)
    assert job_matches_alert(alert, job) is False


@pytest.mark.django_db
def test_inactive_and_expired_jobs_never_match(user):
    alert = create_alert(user)
    inactive = create_job(is_active=False)
    expired = create_job(expires_at=timezone.now() - timedelta(seconds=1))
    assert job_matches_alert(alert, inactive) is False
    assert job_matches_alert(alert, expired) is False
    assert evaluate_job_alerts(inactive) == evaluate_job_alerts(expired) == 0


@pytest.mark.django_db
def test_matching_job_creates_owned_contextual_notification_once(user):
    alert = create_alert(user)
    job = create_job()
    notification = Notification.objects.get(
        notification_type=Notification.Type.JOB_ALERT_MATCH,
        event_key=f"job_alert:{alert.id}:job:{job.id}",
    )
    assert notification.candidate == user.candidate_profile
    assert notification.job == job
    assert alert.name in notification.message and job.title in notification.message
    assert evaluate_job_alerts(job) == 0
    assert Notification.objects.filter(event_key=notification.event_key).count() == 1


@pytest.mark.django_db
def test_same_job_matching_two_alerts_creates_two_notifications(user):
    first = create_alert(user, name="Python", keywords="Python")
    second = create_alert(user, name="Django", keywords="Django")
    job = create_job()
    assert Notification.objects.filter(
        notification_type=Notification.Type.JOB_ALERT_MATCH, job=job
    ).count() == 2
    assert {
        f"job_alert:{first.id}:job:{job.id}",
        f"job_alert:{second.id}:job:{job.id}",
    } == set(Notification.objects.filter(job=job).values_list("event_key", flat=True))


@pytest.mark.django_db
def test_job_becoming_eligible_or_newly_matching_triggers_evaluation(user):
    alert = create_alert(user)
    job = create_job(
        is_active=False,
        title="Java Developer",
        description="Build JVM services.",
        skills=["Java"],
    )
    assert not Notification.objects.exists()
    job.is_active = True
    job.save(update_fields=("is_active", "updated_at"))
    assert not Notification.objects.exists()
    job.title = "Python Developer"
    job.save(update_fields=("title", "updated_at"))
    assert Notification.objects.filter(job=job).count() == 1


@pytest.mark.django_db
def test_unrelated_job_update_skips_alert_evaluation(user):
    alert = create_alert(user)
    job = create_job()
    alert.refresh_from_db()
    checked_at = alert.last_checked_at
    job.application_url = "https://example.com/new-apply"
    job.save(update_fields=("application_url", "updated_at"))
    alert.refresh_from_db()
    assert alert.last_checked_at == checked_at
    assert Notification.objects.filter(job=job).count() == 1


@pytest.mark.django_db
def test_active_alert_limit_allows_inactive_alerts_and_blocks_activation(client, user):
    for index in range(MAX_ACTIVE_ALERTS):
        create_alert(user, name=f"Alert {index}", keywords=f"Keyword {index}")
    blocked = client.post("/api/job-alerts/", {"keywords": "Blocked"}, format="json")
    inactive = client.post(
        "/api/job-alerts/", {"keywords": "Inactive", "is_active": False}, format="json"
    )
    assert blocked.status_code == 400
    assert inactive.status_code == 201
    assert client.post(f"/api/job-alerts/{inactive.data['id']}/toggle/").status_code == 400


@pytest.mark.django_db
def test_candidate_ids_cannot_spoof_ownership(client, other_user):
    for field, value in (
        ("candidate", other_user.candidate_profile.id),
        ("candidate_id", other_user.candidate_profile.id),
        ("user_id", other_user.id),
    ):
        response = client.post(
            "/api/job-alerts/", {"keywords": "Python", field: value}, format="json"
        )
        assert response.status_code == 400
    assert not JobAlert.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/job-alerts/"),
        ("post", "/api/job-alerts/"),
        ("get", "/api/job-alerts/1/"),
        ("patch", "/api/job-alerts/1/"),
        ("delete", "/api/job-alerts/1/"),
        ("post", "/api/job-alerts/1/toggle/"),
    ],
)
def test_authentication_is_required(method, path):
    assert getattr(APIClient(), method)(path, {}, format="json").status_code == 401
