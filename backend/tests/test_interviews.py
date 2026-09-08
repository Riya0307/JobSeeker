from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.applications.models import Application
from apps.candidates.models import CandidateProfile
from apps.interviews.models import Interview
from apps.jobs.models import Job
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


def create_job(**overrides):
    values = {
        "title": "Backend Developer",
        "company_name": "Example Technologies",
        "description": "Build APIs.",
        "location": "Delhi",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.HYBRID,
        "skills": ["Python"],
        "application_url": "https://example.com/apply",
        "source": "fixture",
        "source_job_id": uuid4().hex,
        "posted_at": timezone.now(),
    }
    values.update(overrides)
    return Job.objects.create(**values)


def create_application(user):
    resume = Resume.objects.create(
        candidate=user.candidate_profile,
        title="Resume",
        file=f"resumes/{uuid4().hex}.pdf",
        file_name="resume.pdf",
        file_type="application/pdf",
        file_size=100,
    )
    return Application.objects.create(
        candidate=user.candidate_profile,
        job=create_job(),
        resume=resume,
    )


def interview_payload(application, **overrides):
    values = {
        "application_id": application.id,
        "round_name": "Technical Interview",
        "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
        "duration_minutes": 60,
        "mode": Interview.Mode.ONLINE,
        "meeting_link": "https://meet.example.com/technical",
        "location": "",
        "notes": "Prepare system design examples.",
    }
    values.update(overrides)
    return values


def create_interview(user, **overrides):
    values = {
        "application": create_application(user),
        "round_name": "Technical Interview",
        "scheduled_at": timezone.now() + timedelta(days=2),
        "duration_minutes": 60,
        "mode": Interview.Mode.ONLINE,
        "meeting_link": "https://meet.example.com/technical",
    }
    values.update(overrides)
    return Interview.objects.create(**values)


@pytest.mark.django_db
def test_authenticated_candidate_can_create_interview(client, user):
    application = create_application(user)
    response = client.post("/api/interviews/", interview_payload(application), format="json")
    assert response.status_code == 201
    assert response.data["status"] == Interview.Status.SCHEDULED
    assert response.data["application"]["id"] == application.id
    assert response.data["application"]["job"]["title"] == application.job.title
    assert response.data["round_name"] == "Technical Interview"
    assert response.data["duration_minutes"] == 60
    assert Interview.objects.get().application.candidate == user.candidate_profile


@pytest.mark.django_db
@pytest.mark.parametrize("duration", [0, -10])
def test_invalid_duration_is_rejected(client, user, duration):
    response = client.post(
        "/api/interviews/",
        interview_payload(create_application(user), duration_minutes=duration),
        format="json",
    )
    assert response.status_code == 400
    assert "duration_minutes" in response.data["errors"]


@pytest.mark.django_db
def test_invalid_mode_and_status_are_rejected(client, user):
    application = create_application(user)
    invalid_mode = client.post(
        "/api/interviews/",
        interview_payload(application, mode="video_portal"),
        format="json",
    )
    invalid_status = client.post(
        "/api/interviews/",
        interview_payload(application, status="completed"),
        format="json",
    )
    assert invalid_mode.status_code == 400
    assert "mode" in invalid_mode.data["errors"]
    assert invalid_status.status_code == 400
    assert "status" in invalid_status.data["errors"]


@pytest.mark.django_db
def test_mode_specific_optional_fields_are_supported(client, user):
    phone_application = create_application(user)
    in_person_application = create_application(user)
    phone = client.post(
        "/api/interviews/",
        interview_payload(phone_application, mode="phone", meeting_link=""),
        format="json",
    )
    in_person = client.post(
        "/api/interviews/",
        interview_payload(
            in_person_application,
            mode="in_person",
            meeting_link="",
            location="Bengaluru office",
        ),
        format="json",
    )
    assert phone.status_code == in_person.status_code == 201
    assert in_person.data["location"] == "Bengaluru office"


@pytest.mark.django_db
def test_candidate_cannot_create_for_another_application(client, other_user):
    response = client.post(
        "/api/interviews/",
        interview_payload(create_application(other_user)),
        format="json",
    )
    assert response.status_code == 400
    assert "does not belong" in str(response.data["errors"])
    assert not Interview.objects.exists()


@pytest.mark.django_db
def test_invalid_application_is_rejected(client):
    response = client.post(
        "/api/interviews/",
        interview_payload(type("ApplicationRef", (), {"id": 999999})()),
        format="json",
    )
    assert response.status_code == 400
    assert "application_id" in response.data["errors"]


@pytest.mark.django_db
def test_list_only_returns_current_candidates_interviews(client, user, other_user):
    own = create_interview(user)
    other = create_interview(other_user)
    response = client.get("/api/interviews/")
    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [own.id]
    assert other.id not in [item["id"] for item in response.data["results"]]


@pytest.mark.django_db
def test_list_is_paginated_and_ordered_by_scheduled_time(client, user):
    application = create_application(user)
    interviews = [
        Interview.objects.create(
            application=application,
            round_name=f"Round {index}",
            scheduled_at=timezone.now() + timedelta(days=day),
            duration_minutes=30,
            mode=Interview.Mode.PHONE,
        )
        for index, day in enumerate((3, 1, 2))
    ]
    response = client.get("/api/interviews/", {"page_size": 2})
    assert response.data["count"] == 3
    assert response.data["next"] is not None
    assert [item["id"] for item in response.data["results"]] == [interviews[1].id, interviews[2].id]


@pytest.mark.django_db
def test_status_filter(client, user):
    scheduled = create_interview(user)
    completed = create_interview(user, status=Interview.Status.COMPLETED)
    response = client.get("/api/interviews/", {"status": "completed"})
    assert [item["id"] for item in response.data["results"]] == [completed.id]
    assert scheduled.id not in [item["id"] for item in response.data["results"]]
    assert client.get("/api/interviews/", {"status": "unknown"}).status_code == 400


@pytest.mark.django_db
def test_upcoming_and_past_filters(client, user):
    upcoming = create_interview(user, scheduled_at=timezone.now() + timedelta(days=1))
    past = create_interview(user, scheduled_at=timezone.now() - timedelta(days=1))
    upcoming_response = client.get("/api/interviews/", {"upcoming": "true"})
    past_response = client.get("/api/interviews/", {"past": "1"})
    assert [item["id"] for item in upcoming_response.data["results"]] == [upcoming.id]
    assert [item["id"] for item in past_response.data["results"]] == [past.id]
    assert client.get("/api/interviews/", {"upcoming": "maybe"}).status_code == 400
    assert client.get("/api/interviews/", {"upcoming": "true", "past": "true"}).status_code == 400


@pytest.mark.django_db
def test_owner_can_retrieve_interview_detail(client, user):
    interview = create_interview(user)
    response = client.get(f"/api/interviews/{interview.id}/")
    assert response.status_code == 200
    assert response.data["id"] == interview.id
    assert "candidate" not in response.data
    assert "user" not in response.data


@pytest.mark.django_db
def test_other_candidates_interview_is_hidden(client, other_user):
    interview = create_interview(other_user)
    assert client.get(f"/api/interviews/{interview.id}/").status_code == 404
    assert client.patch(f"/api/interviews/{interview.id}/", {"notes": "Changed"}).status_code == 404
    assert client.post(f"/api/interviews/{interview.id}/status/", {"status": "completed"}).status_code == 404


@pytest.mark.django_db
def test_permitted_patch_fields_work(client, user):
    interview = create_interview(user)
    new_time = timezone.now() + timedelta(days=5)
    response = client.patch(
        f"/api/interviews/{interview.id}/",
        {
            "round_name": "HR Round",
            "scheduled_at": new_time.isoformat(),
            "duration_minutes": 45,
            "mode": "in_person",
            "meeting_link": "",
            "location": "Head office",
            "notes": "Bring identification.",
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["round_name"] == "HR Round"
    assert response.data["mode"] == "in_person"
    assert response.data["location"] == "Head office"


@pytest.mark.django_db
@pytest.mark.parametrize("field", ["application_id", "candidate_id", "user_id", "status", "created_at", "updated_at"])
def test_patch_rejects_reassignment_and_server_fields(client, user, field):
    interview = create_interview(user)
    value = "completed" if field == "status" else 999999
    response = client.patch(
        f"/api/interviews/{interview.id}/",
        {field: value},
        format="json",
    )
    assert response.status_code == 400
    assert field in response.data["errors"]


@pytest.mark.django_db
@pytest.mark.parametrize("new_status", ["completed", "cancelled"])
def test_valid_terminal_status_transitions(client, user, new_status):
    interview = create_interview(user)
    response = client.post(
        f"/api/interviews/{interview.id}/status/",
        {"status": new_status},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["status"] == new_status
    interview.refresh_from_db()
    assert interview.status == new_status


@pytest.mark.django_db
def test_rescheduled_transition_requires_and_updates_time(client, user):
    interview = create_interview(user)
    missing_time = client.post(
        f"/api/interviews/{interview.id}/status/",
        {"status": "rescheduled"},
        format="json",
    )
    new_time = timezone.now() + timedelta(days=10)
    response = client.post(
        f"/api/interviews/{interview.id}/status/",
        {"status": "rescheduled", "scheduled_at": new_time.isoformat()},
        format="json",
    )
    assert missing_time.status_code == 400
    assert response.status_code == 200
    assert response.data["status"] == Interview.Status.RESCHEDULED
    interview.refresh_from_db()
    assert abs(interview.scheduled_at - new_time) < timedelta(seconds=1)


@pytest.mark.django_db
@pytest.mark.parametrize("current_status", ["completed", "cancelled", "rescheduled"])
def test_terminal_statuses_cannot_transition(client, user, current_status):
    interview = create_interview(user, status=current_status)
    response = client.post(
        f"/api/interviews/{interview.id}/status/",
        {"status": "completed"},
        format="json",
    )
    assert response.status_code == 400
    assert "cannot transition" in str(response.data["errors"])


@pytest.mark.django_db
def test_invalid_status_action_is_rejected(client, user):
    interview = create_interview(user)
    response = client.post(
        f"/api/interviews/{interview.id}/status/",
        {"status": "scheduled"},
        format="json",
    )
    assert response.status_code == 400
    assert "status" in response.data["errors"]


@pytest.mark.django_db
def test_multiple_interviews_can_belong_to_one_application(user):
    application = create_application(user)
    first = Interview.objects.create(
        application=application,
        round_name="Technical",
        scheduled_at=timezone.now(),
        duration_minutes=60,
        mode="online",
    )
    second = Interview.objects.create(
        application=application,
        round_name="HR",
        scheduled_at=timezone.now() + timedelta(days=1),
        duration_minutes=30,
        mode="phone",
    )
    assert application.interviews.count() == 2
    assert {first.id, second.id} == set(application.interviews.values_list("id", flat=True))


@pytest.mark.django_db
def test_interviews_follow_application_cascade_policy(user):
    interview = create_interview(user)
    application = interview.application
    application.delete()
    assert not Interview.objects.filter(pk=interview.pk).exists()


@pytest.mark.django_db
def test_delete_and_put_are_not_available(client, user):
    interview = create_interview(user)
    assert client.delete(f"/api/interviews/{interview.id}/").status_code == 405
    assert client.put(f"/api/interviews/{interview.id}/", {}).status_code == 405


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/interviews/"),
        ("post", "/api/interviews/"),
        ("get", "/api/interviews/1/"),
        ("patch", "/api/interviews/1/"),
        ("post", "/api/interviews/1/status/"),
    ],
)
def test_authentication_is_required(method, path):
    response = getattr(APIClient(), method)(path, {}, format="json")
    assert response.status_code == 401
