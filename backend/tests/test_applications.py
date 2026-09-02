from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.applications.models import Application
from apps.candidates.models import CandidateProfile
from apps.jobs.models import Job
from apps.resumes.models import Resume

User = get_user_model()


@pytest.fixture
def user(db):
    user = User.objects.create_user(
        username="candidate@example.com", email="candidate@example.com", password="test-pass"
    )
    CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def other_user(db):
    user = User.objects.create_user(
        username="other@example.com", email="other@example.com", password="test-pass"
    )
    CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def client(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


def create_job(**overrides):
    defaults = {
        "title": "Backend Developer",
        "company_name": "Example Technologies",
        "description": "Build reliable APIs.",
        "location": "Delhi",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.HYBRID,
        "experience_min": 2,
        "experience_max": 5,
        "salary_min": 800000,
        "salary_max": 1400000,
        "skills": ["Python", "Django"],
        "application_url": "https://example.com/apply",
        "source": "fixture",
        "source_job_id": uuid4().hex,
        "posted_at": timezone.now(),
        "expires_at": timezone.now() + timedelta(days=30),
        "is_active": True,
    }
    defaults.update(overrides)
    return Job.objects.create(**defaults)


def create_resume(user, *, primary=False, title="Backend Resume"):
    return Resume.objects.create(
        candidate=user.candidate_profile,
        title=title,
        file=f"resumes/{uuid4().hex}.pdf",
        file_name="candidate_resume.pdf",
        file_type="application/pdf",
        file_size=1024,
        is_primary=primary,
    )


def create_application(user, job=None, resume=None, **overrides):
    return Application.objects.create(
        candidate=user.candidate_profile,
        job=job or create_job(),
        resume=resume or create_resume(user),
        **overrides,
    )


@pytest.mark.django_db
def test_candidate_can_apply_with_selected_resume_and_cover_letter(client, user):
    job = create_job()
    resume = create_resume(user)
    response = client.post(
        "/api/applications/",
        {"job_id": job.id, "resume_id": resume.id, "cover_letter": "I am interested."},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == Application.Status.APPLIED
    assert response.data["resume"]["id"] == resume.id
    assert response.data["cover_letter"] == "I am interested."
    application = Application.objects.get()
    assert application.candidate == user.candidate_profile
    assert application.job == job
    assert application.resume == resume


@pytest.mark.django_db
def test_primary_resume_fallback(client, user):
    primary = create_resume(user, primary=True)
    create_resume(user, title="Other Resume")
    response = client.post("/api/applications/", {"job_id": create_job().id}, format="json")
    assert response.status_code == 201
    assert response.data["resume"]["id"] == primary.id


@pytest.mark.django_db
def test_missing_resume_without_primary_is_rejected(client):
    response = client.post("/api/applications/", {"job_id": create_job().id}, format="json")
    assert response.status_code == 400
    assert "resume_id" in response.data["errors"]


@pytest.mark.django_db
def test_authentication_is_required_for_all_application_endpoints():
    client = APIClient()
    assert client.get("/api/applications/").status_code == 401
    assert client.post("/api/applications/", {}).status_code == 401
    assert client.get("/api/applications/1/").status_code == 401
    assert client.post("/api/applications/1/withdraw/").status_code == 401


@pytest.mark.django_db
def test_cannot_apply_with_another_candidates_resume(client, other_user):
    response = client.post(
        "/api/applications/",
        {"job_id": create_job().id, "resume_id": create_resume(other_user).id},
        format="json",
    )
    assert response.status_code == 400
    assert "own resumes" in str(response.data["errors"])
    assert not Application.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "field",
    ["candidate_id", "user_id", "owner_id", "status", "applied_at", "updated_at", "withdrawn_at"],
)
def test_server_controlled_fields_are_rejected(client, user, field):
    payload = {
        "job_id": create_job().id,
        "resume_id": create_resume(user).id,
        field: other_value(field),
    }
    response = client.post("/api/applications/", payload, format="json")
    assert response.status_code == 400
    assert field in response.data["errors"]
    assert not Application.objects.exists()


def other_value(field):
    if field == "status":
        return Application.Status.SHORTLISTED
    if field.endswith("_at"):
        return timezone.now().isoformat()
    return 999999


@pytest.mark.django_db
def test_duplicate_application_is_rejected_cleanly(client, user):
    job = create_job()
    resume = create_resume(user)
    payload = {"job_id": job.id, "resume_id": resume.id}
    assert client.post("/api/applications/", payload, format="json").status_code == 201
    duplicate = client.post("/api/applications/", payload, format="json")
    assert duplicate.status_code == 400
    assert "already applied" in str(duplicate.data["errors"])
    assert Application.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize(
    "job_overrides",
    [
        {"is_active": False},
        {"expires_at": timezone.now() - timedelta(seconds=1)},
    ],
)
def test_unavailable_jobs_are_rejected(client, user, job_overrides):
    response = client.post(
        "/api/applications/",
        {"job_id": create_job(**job_overrides).id, "resume_id": create_resume(user).id},
        format="json",
    )
    assert response.status_code == 400
    assert "not accepting" in str(response.data["errors"])


@pytest.mark.django_db
def test_invalid_job_id_is_handled(client, user):
    response = client.post(
        "/api/applications/",
        {"job_id": 999999, "resume_id": create_resume(user).id},
        format="json",
    )
    assert response.status_code == 400
    assert "Job not found" in str(response.data["errors"])


@pytest.mark.django_db
def test_cover_letter_length_and_type_are_validated(client, user):
    resume = create_resume(user)
    too_long = client.post(
        "/api/applications/",
        {"job_id": create_job().id, "resume_id": resume.id, "cover_letter": "x" * 10001},
        format="json",
    )
    invalid_type = client.post(
        "/api/applications/",
        {"job_id": create_job().id, "resume_id": resume.id, "cover_letter": ["invalid"]},
        format="json",
    )
    assert too_long.status_code == 400
    assert invalid_type.status_code == 400
    assert "cover_letter" in too_long.data["errors"]


@pytest.mark.django_db
def test_candidate_sees_only_own_applications(client, user, other_user):
    own = create_application(user)
    other = create_application(other_user)
    response = client.get("/api/applications/")
    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [own.id]
    assert other.id not in [item["id"] for item in response.data["results"]]


@pytest.mark.django_db
def test_application_list_is_paginated_and_newest_first(client, user):
    applications = [create_application(user) for _ in range(3)]
    old_time = timezone.now() - timedelta(days=5)
    Application.objects.filter(pk=applications[0].pk).update(applied_at=old_time)
    response = client.get("/api/applications/", {"page_size": 2})
    assert response.status_code == 200
    assert response.data["count"] == 3
    assert len(response.data["results"]) == 2
    assert response.data["next"] is not None
    assert [item["id"] for item in response.data["results"]] == [applications[2].id, applications[1].id]


@pytest.mark.django_db
def test_owner_can_retrieve_safe_application_detail(client, user):
    application = create_application(user, cover_letter="Plain text")
    response = client.get(f"/api/applications/{application.id}/")
    assert response.status_code == 200
    assert response.data["job"]["title"] == application.job.title
    assert response.data["resume"]["file_name"] == application.resume.file_name
    assert response.data["cover_letter"] == "Plain text"
    assert "file" not in response.data["resume"]
    assert "candidate" not in response.data


@pytest.mark.django_db
def test_other_application_is_hidden_for_detail_and_withdraw(client, other_user):
    application = create_application(other_user)
    assert client.get(f"/api/applications/{application.id}/").status_code == 404
    assert client.post(f"/api/applications/{application.id}/withdraw/").status_code == 404
    application.refresh_from_db()
    assert application.status == Application.Status.APPLIED


@pytest.mark.django_db
def test_owner_can_withdraw_and_history_remains(client, user):
    application = create_application(user)
    original_updated_at = application.updated_at
    response = client.post(f"/api/applications/{application.id}/withdraw/")
    assert response.status_code == 200
    assert response.data["status"] == Application.Status.WITHDRAWN
    assert response.data["withdrawn_at"] is not None
    application.refresh_from_db()
    assert application.status == Application.Status.WITHDRAWN
    assert application.withdrawn_at is not None
    assert application.updated_at >= original_updated_at
    assert Application.objects.filter(pk=application.pk).exists()


@pytest.mark.django_db
def test_already_withdrawn_cannot_be_withdrawn_again(client, user):
    application = create_application(user)
    assert client.post(f"/api/applications/{application.id}/withdraw/").status_code == 200
    repeated = client.post(f"/api/applications/{application.id}/withdraw/")
    assert repeated.status_code == 400
    assert "already" in str(repeated.data["errors"])


@pytest.mark.django_db
def test_candidates_have_no_general_update_or_status_reset_endpoint(client, user):
    application = create_application(user, status=Application.Status.WITHDRAWN, withdrawn_at=timezone.now())
    payload = {"status": Application.Status.APPLIED}
    assert client.patch(f"/api/applications/{application.id}/", payload, format="json").status_code == 405
    assert client.put(f"/api/applications/{application.id}/", payload, format="json").status_code == 405
    application.refresh_from_db()
    assert application.status == Application.Status.WITHDRAWN


@pytest.mark.django_db
def test_database_constraint_protects_duplicate_applications(user):
    job = create_job()
    resume = create_resume(user)
    create_application(user, job=job, resume=resume)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            create_application(user, job=job, resume=resume)
    assert Application.objects.filter(candidate=user.candidate_profile, job=job).count() == 1


@pytest.mark.django_db
def test_missing_candidate_profile_is_rejected_without_creation(db):
    user = User.objects.create_user(username="no-profile@example.com", password="test-pass")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.post("/api/applications/", {"job_id": create_job().id}, format="json")
    assert response.status_code == 400
    assert "profile" in str(response.data["errors"])
    assert not CandidateProfile.objects.filter(user=user).exists()
