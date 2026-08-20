from pathlib import Path

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile
from apps.resumes.models import Resume

User = get_user_model()
PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"


@pytest.fixture(autouse=True)
def local_media(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path, RESUME_MAX_FILE_SIZE=1024):
        yield tmp_path


@pytest.fixture
def user(db):
    user = User.objects.create_user(
        username="owner@example.com", email="owner@example.com", password="Strong-pass-2026!"
    )
    CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def other_user(db):
    user = User.objects.create_user(
        username="other@example.com", email="other@example.com", password="Strong-pass-2026!"
    )
    CandidateProfile.objects.create(user=user)
    return user


@pytest.fixture
def client(user):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")
    return client


def pdf(name="resume.pdf", content=PDF_BYTES, content_type="application/pdf"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def upload(client, title="Software Developer Resume", name="riya_resume.pdf", **extra):
    return client.post(
        "/api/resumes/", {"title": title, "file": pdf(name), **extra}, format="multipart"
    )


@pytest.mark.django_db
def test_successful_pdf_upload_returns_safe_metadata(client, local_media):
    response = upload(client, is_primary=True)

    assert response.status_code == 201
    assert response.data["title"] == "Software Developer Resume"
    assert response.data["file_name"] == "riya_resume.pdf"
    assert response.data["file_type"] == "application/pdf"
    assert response.data["file_size"] == len(PDF_BYTES)
    assert response.data["is_primary"] is True
    assert "file" not in response.data
    assert "candidate" not in response.data
    resume = Resume.objects.get()
    assert resume.file.name != resume.file_name
    assert Path(resume.file.path).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("upload_file", "message"),
    [
        (pdf("resume.txt"), ".pdf extension"),
        (pdf(content_type="text/plain"), "content type"),
        (pdf(content=b"not really a PDF"), "valid PDF"),
    ],
)
def test_invalid_file_type_is_rejected(client, upload_file, message):
    response = client.post(
        "/api/resumes/", {"title": "Invalid", "file": upload_file}, format="multipart"
    )
    assert response.status_code == 400
    assert message in str(response.data)


@pytest.mark.django_db
def test_oversized_file_is_rejected(client):
    response = client.post(
        "/api/resumes/",
        {"title": "Huge", "file": pdf(content=b"%PDF-" + b"x" * 1024)},
        format="multipart",
    )
    assert response.status_code == 400
    assert "exceed" in str(response.data)


@pytest.mark.django_db
@pytest.mark.parametrize("include_file", [False, True])
def test_missing_or_empty_file_is_rejected(client, include_file):
    data = {"title": "Missing"}
    if include_file:
        data["file"] = pdf(content=b"")
    response = client.post("/api/resumes/", data, format="multipart")
    assert response.status_code == 400
    assert "file" in response.data["errors"]


@pytest.mark.django_db
def test_list_and_retrieve_only_own_resumes(client, user, other_user):
    own_id = upload(client, title="Mine").data["id"]
    other = Resume.objects.create(
        candidate=other_user.candidate_profile,
        title="Not mine",
        file=pdf("other.pdf"),
        file_name="other.pdf",
        file_type="application/pdf",
        file_size=len(PDF_BYTES),
    )

    listing = client.get("/api/resumes/")
    own = client.get(f"/api/resumes/{own_id}/")
    forbidden = client.get(f"/api/resumes/{other.id}/")

    assert listing.status_code == 200
    assert [item["title"] for item in listing.data] == ["Mine"]
    assert own.status_code == 200
    assert own.data["id"] == own_id
    assert forbidden.status_code == 404


@pytest.mark.django_db
def test_update_resume_and_replace_file(
    client, local_media, django_capture_on_commit_callbacks
):
    resume_id = upload(client).data["id"]
    old_path = Path(Resume.objects.get(pk=resume_id).file.path)

    with django_capture_on_commit_callbacks(execute=True):
        response = client.patch(
            f"/api/resumes/{resume_id}/",
            {"title": "Updated Resume", "file": pdf("updated.pdf")},
            format="multipart",
        )

    assert response.status_code == 200
    assert response.data["title"] == "Updated Resume"
    assert response.data["file_name"] == "updated.pdf"
    assert not old_path.exists()


@pytest.mark.django_db
def test_delete_resume_removes_record_and_file(client, django_capture_on_commit_callbacks):
    resume_id = upload(client).data["id"]
    path = Path(Resume.objects.get(pk=resume_id).file.path)
    with django_capture_on_commit_callbacks(execute=True):
        response = client.delete(f"/api/resumes/{resume_id}/")
    assert response.status_code == 204
    assert not Resume.objects.filter(pk=resume_id).exists()
    assert not path.exists()


@pytest.mark.django_db
def test_set_and_switch_primary_resume(client, user):
    first_id = upload(client, title="First", is_primary=True).data["id"]
    second_id = upload(client, title="Second").data["id"]

    response = client.post(f"/api/resumes/{second_id}/set-primary/")

    assert response.status_code == 200
    assert response.data["is_primary"] is True
    assert not Resume.objects.get(pk=first_id).is_primary
    assert Resume.objects.get(pk=second_id).is_primary
    assert user.candidate_profile.resumes.count() == 2


@pytest.mark.django_db
def test_creating_primary_switches_previous_primary(client):
    first_id = upload(client, title="First", is_primary=True).data["id"]
    second_id = upload(client, title="Second", is_primary=True).data["id"]
    assert not Resume.objects.get(pk=first_id).is_primary
    assert Resume.objects.get(pk=second_id).is_primary


@pytest.mark.django_db
def test_deleting_primary_promotes_most_recently_updated(client):
    older_id = upload(client, title="Older").data["id"]
    newer_id = upload(client, title="Newer").data["id"]
    primary_id = upload(client, title="Primary", is_primary=True).data["id"]

    response = client.delete(f"/api/resumes/{primary_id}/")

    assert response.status_code == 204
    assert Resume.objects.get(pk=newer_id).is_primary
    assert not Resume.objects.get(pk=older_id).is_primary


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/resumes/"),
        ("post", "/api/resumes/"),
        ("get", "/api/resumes/1/"),
        ("patch", "/api/resumes/1/"),
        ("delete", "/api/resumes/1/"),
        ("post", "/api/resumes/1/set-primary/"),
    ],
)
def test_unauthenticated_access_is_rejected(method, path):
    client = APIClient()
    response = getattr(client, method)(path, {}, format="json")
    assert response.status_code == 401
