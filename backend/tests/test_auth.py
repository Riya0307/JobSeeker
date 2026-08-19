import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def registration_payload():
    return {
        "email": "candidate@example.com",
        "password": "A-strong-portfolio-password-2026!",
        "first_name": "Riya",
        "last_name": "Sharma",
    }


@pytest.fixture
def user(db, registration_payload):
    return User.objects.create_user(
        username=registration_payload["email"],
        email=registration_payload["email"],
        password=registration_payload["password"],
        first_name=registration_payload["first_name"],
        last_name=registration_payload["last_name"],
    )


@pytest.mark.django_db
def test_successful_registration_returns_tokens_and_safe_user(api_client, registration_payload):
    response = api_client.post("/api/auth/register/", registration_payload, format="json")

    assert response.status_code == 201
    assert response.data["data"]["access"]
    assert response.data["data"]["refresh"]
    assert response.data["data"]["user"]["email"] == registration_payload["email"]
    assert "password" not in response.data["data"]["user"]
    created_user = User.objects.get(email=registration_payload["email"])
    assert created_user.check_password(registration_payload["password"])


@pytest.mark.django_db
def test_duplicate_email_is_rejected_case_insensitively(api_client, user, registration_payload):
    payload = {**registration_payload, "email": registration_payload["email"].upper()}
    response = api_client.post("/api/auth/register/", payload, format="json")

    assert response.status_code == 400
    assert "email" in response.data["errors"]


@pytest.mark.django_db
def test_invalid_password_is_rejected(api_client, registration_payload):
    response = api_client.post(
        "/api/auth/register/", {**registration_payload, "password": "123"}, format="json"
    )

    assert response.status_code == 400
    assert "password" in response.data["errors"]


@pytest.mark.django_db
def test_successful_login(api_client, user, registration_payload):
    response = api_client.post(
        "/api/auth/login/",
        {"email": user.email, "password": registration_payload["password"]},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["data"]["access"]
    assert response.data["data"]["refresh"]
    assert response.data["data"]["user"]["id"] == user.id


@pytest.mark.django_db
def test_invalid_login(api_client, user):
    response = api_client.post(
        "/api/auth/login/", {"email": user.email, "password": "incorrect"}, format="json"
    )

    assert response.status_code == 400
    assert "non_field_errors" in response.data["errors"]


@pytest.mark.django_db
def test_authenticated_current_user(api_client, user):
    CandidateProfile.objects.create(user=user, headline="Backend engineer")
    api_client.force_authenticate(user=user)

    response = api_client.get("/api/auth/me/")

    assert response.status_code == 200
    assert response.data["data"]["email"] == user.email
    assert response.data["data"]["profile"]["headline"] == "Backend engineer"


@pytest.mark.django_db
def test_unauthenticated_current_user(api_client):
    response = api_client.get("/api/auth/me/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_registration_creates_candidate_profile(api_client, registration_payload):
    api_client.post("/api/auth/register/", registration_payload, format="json")
    user = User.objects.get(email=registration_payload["email"])
    assert CandidateProfile.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_profile_update(api_client, user):
    api_client.force_authenticate(user=user)
    response = api_client.patch(
        "/api/profile/",
        {
            "headline": "Python engineer",
            "years_of_experience": 3,
            "skills": ["Python", "Django"],
        },
        format="json",
    )

    assert response.status_code == 200
    profile = CandidateProfile.objects.get(user=user)
    assert profile.headline == "Python engineer"
    assert profile.skills == ["Python", "Django"]


@pytest.mark.django_db
def test_jwt_refresh(api_client, user):
    refresh = RefreshToken.for_user(user)
    response = api_client.post(
        "/api/auth/token/refresh/", {"refresh": str(refresh)}, format="json"
    )

    assert response.status_code == 200
    assert response.data["data"]["access"]


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api_client, user):
    refresh = RefreshToken.for_user(user)
    api_client.force_authenticate(user=user)

    response = api_client.post("/api/auth/logout/", {"refresh": str(refresh)}, format="json")
    retry = api_client.post(
        "/api/auth/token/refresh/", {"refresh": str(refresh)}, format="json"
    )

    assert response.status_code == 200
    assert retry.status_code == 401
