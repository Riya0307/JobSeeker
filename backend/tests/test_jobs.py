from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile
from apps.jobs.models import Job, SavedJob

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


def create_job(index=1, **overrides):
    defaults = {
        "title": f"Python Engineer {index}",
        "company_name": f"Company {index}",
        "description": "Build reliable Django APIs.",
        "location": "Delhi",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.REMOTE,
        "experience_min": 2,
        "experience_max": 5,
        "salary_min": 800000,
        "salary_max": 1400000,
        "skills": ["Python", "Django"],
        "application_url": f"https://example.com/jobs/{index}",
        "source": "fixture",
        "source_job_id": str(index),
        "posted_at": timezone.now() - timedelta(days=index),
        "expires_at": timezone.now() + timedelta(days=30),
        "is_active": True,
    }
    defaults.update(overrides)
    return Job.objects.create(**defaults)


@pytest.mark.django_db
def test_job_listing_returns_only_active_jobs(client):
    active = create_job(1)
    create_job(2, is_active=False)
    response = client.get("/api/jobs/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["id"] == active.id


@pytest.mark.django_db
def test_job_detail_and_invalid_or_inactive_job_id(client):
    job = create_job()
    inactive = create_job(2, is_active=False)
    assert client.get(f"/api/jobs/{job.id}/").status_code == 200
    assert client.get(f"/api/jobs/{inactive.id}/").status_code == 404
    assert client.get("/api/jobs/999999/").status_code == 404


@pytest.mark.django_db
def test_keyword_search_matches_title_company_description_location_and_skills(client):
    wanted = create_job(title="Platform Developer", skills=["Python", "Kubernetes"])
    create_job(2, title="Accountant", description="Finance reporting", skills=["Excel"])
    response = client.get("/api/jobs/", {"search": "kubernetes"})
    assert [item["id"] for item in response.data["results"]] == [wanted.id]


@pytest.mark.django_db
def test_job_filters_support_location_modes_ranges_and_all_skills(client):
    wanted = create_job()
    create_job(
        2,
        location="Mumbai",
        work_mode=Job.WorkMode.ONSITE,
        employment_type="contract",
        experience_min=7,
        experience_max=10,
        salary_min=2000000,
        salary_max=3000000,
        skills=["Java"],
    )
    response = client.get(
        "/api/jobs/",
        {
            "location": "del",
            "work_mode": "remote",
            "employment_type": "FULL-TIME",
            "experience_min": 3,
            "experience_max": 4,
            "salary_min": 900000,
            "salary_max": 1200000,
            "skills": "python,django",
        },
    )
    assert [item["id"] for item in response.data["results"]] == [wanted.id]


@pytest.mark.django_db
def test_pagination(client):
    for index in range(1, 6):
        create_job(index)
    response = client.get("/api/jobs/", {"page": 2, "page_size": 2})
    assert response.status_code == 200
    assert response.data["count"] == 5
    assert len(response.data["results"]) == 2
    assert response.data["next"] is not None
    assert response.data["previous"] is not None


@pytest.mark.django_db
def test_ordering(client):
    lower = create_job(1, salary_min=500000, salary_max=700000)
    higher = create_job(2, salary_min=1500000, salary_max=1800000)
    response = client.get("/api/jobs/", {"ordering": "-salary_min"})
    assert [item["id"] for item in response.data["results"]] == [higher.id, lower.id]


@pytest.mark.django_db
def test_unsupported_ordering_and_invalid_ranges_are_rejected(client):
    create_job()
    assert client.get("/api/jobs/", {"ordering": "description"}).status_code == 400
    assert client.get("/api/jobs/", {"salary_min": "many"}).status_code == 400


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/jobs/"),
        ("get", "/api/jobs/1/"),
        ("get", "/api/jobs/saved/"),
        ("post", "/api/jobs/1/save/"),
        ("delete", "/api/jobs/1/save/"),
    ],
)
def test_authentication_is_required(method, path):
    response = getattr(APIClient(), method)(path)
    assert response.status_code == 401


@pytest.mark.django_db
def test_jobs_are_read_only_for_candidates(client):
    assert client.post("/api/jobs/", {}, format="json").status_code == 405


@pytest.mark.django_db
def test_save_duplicate_save_and_unsave(client, user):
    job = create_job()
    first = client.post(f"/api/jobs/{job.id}/save/")
    duplicate = client.post(f"/api/jobs/{job.id}/save/")
    assert first.status_code == 201
    assert duplicate.status_code == 200
    assert SavedJob.objects.filter(candidate=user.candidate_profile, job=job).count() == 1
    assert first.data["is_saved"] is True

    removed = client.delete(f"/api/jobs/{job.id}/save/")
    repeated = client.delete(f"/api/jobs/{job.id}/save/")
    assert removed.status_code == repeated.status_code == 204
    assert not SavedJob.objects.filter(candidate=user.candidate_profile, job=job).exists()


@pytest.mark.django_db
def test_saved_job_listing_is_isolated_by_candidate(client, user, other_user):
    mine = create_job(1)
    theirs = create_job(2)
    SavedJob.objects.create(candidate=user.candidate_profile, job=mine)
    SavedJob.objects.create(candidate=other_user.candidate_profile, job=theirs)
    response = client.get("/api/jobs/saved/")
    assert response.status_code == 200
    assert [item["id"] for item in response.data["results"]] == [mine.id]
    assert response.data["results"][0]["is_saved"] is True


@pytest.mark.django_db
def test_save_and_unsave_invalid_job_id(client):
    assert client.post("/api/jobs/999999/save/").status_code == 404
    assert client.delete("/api/jobs/999999/save/").status_code == 404
