from datetime import timedelta
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile
from apps.jobs.models import Job, SavedJob
from apps.matching.services import calculate_match, normalize_skill

User = get_user_model()


@pytest.fixture
def candidate_user(db):
    user = User.objects.create_user(
        username="candidate@example.com", email="candidate@example.com", password="test-pass"
    )
    CandidateProfile.objects.create(
        user=user,
        location="Delhi",
        years_of_experience=3,
        skills=["Python", "Django", "SQL"],
    )
    return user


@pytest.fixture
def other_user(db):
    user = User.objects.create_user(
        username="other@example.com", email="other@example.com", password="test-pass"
    )
    CandidateProfile.objects.create(
        user=user,
        location="Mumbai",
        years_of_experience=0,
        skills=["Java"],
    )
    return user


@pytest.fixture
def client(candidate_user):
    client = APIClient()
    token = RefreshToken.for_user(candidate_user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def create_job(**overrides):
    defaults = {
        "title": "Python Developer",
        "company_name": "Example Technologies",
        "description": "Build reliable APIs.",
        "location": "Delhi",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.HYBRID,
        "experience_min": 2,
        "experience_max": 5,
        "salary_min": 800000,
        "salary_max": 1400000,
        "skills": ["Python", "Django", "SQL"],
        "application_url": "https://example.com/apply",
        "source": "fixture",
        "source_job_id": uuid4().hex,
        "posted_at": timezone.now(),
        "expires_at": timezone.now() + timedelta(days=30),
        "is_active": True,
    }
    defaults.update(overrides)
    return Job.objects.create(**defaults)


def match(profile, **job_overrides):
    return calculate_match(profile, create_job(**job_overrides))


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (" Python ", "python"),
        ("PYTHON", "python"),
        (" React   JS ", "react js"),
        ("react-js", "react js"),
        ("react.js", "react js"),
        (None, ""),
    ],
)
def test_skill_normalization(value, expected):
    assert normalize_skill(value) == expected


@pytest.mark.django_db
def test_exact_case_and_whitespace_skill_matches_preserve_job_casing(candidate_user):
    result = match(
        candidate_user.candidate_profile,
        skills=[" python ", "DJANGO", "React JS"],
    )
    assert result.matched_skills == ["python", "DJANGO"]
    assert result.missing_skills == ["React JS"]
    assert result.match_score == 83


@pytest.mark.django_db
def test_all_partial_and_no_skills_matched(candidate_user):
    profile = candidate_user.candidate_profile
    all_result = match(profile, skills=["Python", "Django"])
    partial_result = match(profile, skills=["Python", "Docker"])
    none_result = match(profile, skills=["Go", "Docker"])
    assert all_result.match_score == 100
    assert partial_result.match_score == 75
    assert none_result.match_score == 50
    assert partial_result.missing_skills == ["Docker"]
    assert "Strong skills match" in all_result.reasons
    assert "Several required skills are missing" in partial_result.reasons
    assert "Required skills are missing" in none_result.reasons


@pytest.mark.django_db
def test_candidate_with_no_skills_and_job_with_no_skills(candidate_user):
    profile = candidate_user.candidate_profile
    profile.skills = []
    no_candidate_skills = match(profile, skills=["Python"])
    no_job_skills = match(profile, skills=[])
    assert no_candidate_skills.matched_skills == []
    assert no_candidate_skills.missing_skills == ["Python"]
    assert no_job_skills.match_score == 100
    assert "not penalized" in no_job_skills.reasons[0]


@pytest.mark.django_db
def test_malformed_skill_data_is_safe(candidate_user):
    profile = candidate_user.candidate_profile
    profile.skills = {"unexpected": "shape"}
    result = match(profile, skills={"also": "invalid"})
    assert result.matched_skills == []
    assert result.missing_skills == []
    assert 0 <= result.match_score <= 100


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("years", "minimum", "maximum", "expected_experience_points", "reason"),
    [
        (3, 2, 5, 20, "compatible"),
        (2, 3, 5, 15, "below"),
        (1, 3, 5, 10, "below"),
        (8, 2, 5, 18, "exceeds"),
        (0, 2, 5, 10, "below"),
        (3, None, None, 20, "No experience"),
    ],
)
def test_experience_scoring(
    candidate_user, years, minimum, maximum, expected_experience_points, reason
):
    profile = candidate_user.candidate_profile
    profile.years_of_experience = years
    result = match(profile, experience_min=minimum, experience_max=maximum)
    # Other fully compatible components contribute 80 points.
    assert result.match_score == 80 + expected_experience_points
    assert reason in result.reasons[1]


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("candidate_location", "job_location", "work_mode", "expected_location_points", "reason"),
    [
        (" Delhi ", "DELHI", Job.WorkMode.ONSITE, 15, "Location matches"),
        ("Delhi", "Mumbai", Job.WorkMode.HYBRID, 0, "differs"),
        ("Delhi", "Mumbai", Job.WorkMode.REMOTE, 15, "Remote work"),
        ("", "Mumbai", Job.WorkMode.ONSITE, 8, "unknown"),
    ],
)
def test_location_scoring(
    candidate_user, candidate_location, job_location, work_mode, expected_location_points, reason
):
    profile = candidate_user.candidate_profile
    profile.location = candidate_location
    result = match(profile, location=job_location, work_mode=work_mode)
    # Skills, experience, and neutral work-mode components contribute 85 points.
    assert result.match_score == 85 + expected_location_points
    assert reason in result.reasons[2]


@pytest.mark.django_db
@pytest.mark.parametrize("work_mode", list(Job.WorkMode.values))
def test_work_modes_are_neutral_without_candidate_preference(candidate_user, work_mode):
    result = match(candidate_user.candidate_profile, work_mode=work_mode)
    assert result.match_score == 100
    assert "no work-mode preference is specified" in result.reasons[3]


@pytest.mark.django_db
def test_score_is_deterministic_integer_and_bounded(candidate_user):
    profile = candidate_user.candidate_profile
    job = create_job(skills=["Python", "Docker", "Redis"])
    first = calculate_match(profile, job)
    second = calculate_match(profile, job)
    assert first == second
    assert isinstance(first.match_score, int)
    assert first.match_score == 67
    assert 0 <= first.match_score <= 100


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["/api/matching/jobs/", "/api/matching/jobs/1/"])
def test_matching_requires_authentication(path):
    assert APIClient().get(path).status_code == 401


@pytest.mark.django_db
def test_authenticated_matching_list_and_saved_state(client, candidate_user):
    job = create_job()
    SavedJob.objects.create(candidate=candidate_user.candidate_profile, job=job)
    response = client.get("/api/matching/jobs/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    item = response.data["results"][0]
    assert item["job"]["id"] == job.id
    assert item["job"]["is_saved"] is True
    assert item["match_score"] == 100


@pytest.mark.django_db
def test_matching_detail(client):
    job = create_job(skills=["Python", "Docker"])
    response = client.get(f"/api/matching/jobs/{job.id}/")
    assert response.status_code == 200
    assert response.data["job"]["id"] == job.id
    assert response.data["match_score"] == 75
    assert response.data["matched_skills"] == ["Python"]
    assert response.data["missing_skills"] == ["Docker"]
    assert len(response.data["reasons"]) == 4


@pytest.mark.django_db
def test_list_orders_by_descending_score(client):
    low = create_job(title="Low", skills=["Go", "Rust"])
    high = create_job(title="High", skills=["Python"])
    middle = create_job(title="Middle", skills=["Python", "Go"])
    response = client.get("/api/matching/jobs/")
    ids = [item["job"]["id"] for item in response.data["results"]]
    assert ids == [high.id, middle.id, low.id]
    scores = [item["match_score"] for item in response.data["results"]]
    assert scores == sorted(scores, reverse=True)


@pytest.mark.django_db
def test_matching_list_pagination(client):
    for index in range(11):
        create_job(title=f"Job {index}")
    response = client.get("/api/matching/jobs/", {"page": 2})
    assert response.status_code == 200
    assert response.data["count"] == 11
    assert len(response.data["results"]) == 1
    assert response.data["previous"] is not None


@pytest.mark.django_db
def test_invalid_inactive_and_expired_jobs_return_404(client):
    inactive = create_job(is_active=False)
    expired = create_job(expires_at=timezone.now() - timedelta(seconds=1))
    assert client.get("/api/matching/jobs/999999/").status_code == 404
    assert client.get(f"/api/matching/jobs/{inactive.id}/").status_code == 404
    assert client.get(f"/api/matching/jobs/{expired.id}/").status_code == 404
    listing = client.get("/api/matching/jobs/")
    assert listing.data["count"] == 0


@pytest.mark.django_db
def test_missing_candidate_profile_returns_clean_error(db):
    user = User.objects.create_user(username="no-profile@example.com", password="test-pass")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get("/api/matching/jobs/")
    assert response.status_code == 404
    assert "profile" in str(response.data["errors"]).lower()
    assert not CandidateProfile.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_candidate_isolation_and_candidate_id_is_ignored(client, candidate_user, other_user):
    job = create_job(skills=["Python"])
    other_result = calculate_match(other_user.candidate_profile, job)
    response = client.get("/api/matching/jobs/", {"candidate_id": other_user.id})
    own_result = response.data["results"][0]
    assert own_result["match_score"] == 100
    assert own_result["matched_skills"] == ["Python"]
    assert own_result["match_score"] != other_result.match_score
    assert candidate_user.candidate_profile.skills == ["Python", "Django", "SQL"]
