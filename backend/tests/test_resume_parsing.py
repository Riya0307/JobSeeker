from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.candidates.models import CandidateProfile
from apps.resumes.models import Resume, ResumeParsedData
from apps.resumes.parsing import parse_resume, parse_structured_text

User = get_user_model()


def text_pdf(lines):
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    font_ref = writer._add_object(font)
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})})
    escaped = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines]
    content = "BT /F1 11 Tf 72 740 Td 14 TL " + " Tj T* ".join(f"({line})" for line in escaped) + " Tj ET"
    stream = DecodedStreamObject(); stream.set_data(content.encode("latin-1"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = BytesIO(); writer.write(output)
    return output.getvalue()


@pytest.fixture(autouse=True)
def media(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        yield


@pytest.fixture
def owner(db):
    user = User.objects.create_user(username="parse@example.com", email="parse@example.com", password="Pass-2026!")
    CandidateProfile.objects.create(user=user, headline="Keep me", current_company="Manual Co")
    return user


@pytest.fixture
def client(owner):
    result = APIClient(); result.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(owner).access_token}")
    return result


def make_resume(owner, content=None):
    content = content or text_pdf(["Skills", "Python, Django", "Experience", "Engineer at Acme | Jan 2020 - Present"])
    return Resume.objects.create(candidate=owner.candidate_profile, title="CV", file=SimpleUploadedFile("cv.pdf", content, content_type="application/pdf"), file_name="cv.pdf", file_type="application/pdf", file_size=len(content))


def test_deterministic_sections_skills_and_overlapping_experience():
    parsed = parse_structured_text("Skills\n Python, python ; Django \nExperience\nEngineer at Acme | Jan 2020 - Dec 2022\nLead at Beta | Jan 2022 - Present\nEducation\nBSc Computer Science\nProjects\nPortfolio\nCertifications\nAWS")
    assert parsed.skills == ["Python", "Django"]
    assert parsed.job_titles == ["Engineer", "Lead"]
    assert parsed.companies == ["Acme", "Beta"]
    assert parsed.estimated_experience_months is not None
    assert parsed.education == [{"summary": "BSc Computer Science"}]


@pytest.mark.django_db
def test_parse_service_is_idempotent_and_sets_last_results(owner):
    resume = make_resume(owner)
    first = parse_resume(resume.id)
    second = parse_resume(resume.id)
    parsed = resume.parsed_data
    assert first["status"] == "completed"
    assert second["cached"] is True
    assert parsed.skills == ["Python", "Django"]
    assert parsed.file_hash and parsed.extracted_at


@pytest.mark.django_db
def test_malformed_and_image_only_pdf_fail_safely(owner):
    malformed = make_resume(owner, b"%PDF-not-valid")
    result = parse_resume(malformed.id)
    assert result["status"] == "failed"
    blank = BytesIO(); writer = PdfWriter(); writer.add_blank_page(width=100, height=100); writer.write(blank)
    other = make_resume(owner, blank.getvalue())
    assert parse_resume(other.id)["status"] == "failed"
    assert "OCR" in other.parsed_data.parsing_error


@pytest.mark.django_db
def test_parse_endpoints_are_owned_and_queue_explicitly(client, owner, monkeypatch):
    own = make_resume(owner)
    other_user = User.objects.create_user(username="other-p@example.com", email="other-p@example.com", password="Pass-2026!")
    CandidateProfile.objects.create(user=other_user)
    foreign = make_resume(other_user)
    queued = []
    monkeypatch.setattr("apps.resumes.tasks.parse_resume_task.delay", lambda resume_id: queued.append(resume_id))
    response = client.post(f"/api/resumes/{own.id}/parse/")
    assert response.status_code == 202 and queued == [own.id]
    assert client.post(f"/api/resumes/{foreign.id}/parse/").status_code == 404
    assert client.get(f"/api/resumes/{foreign.id}/parsed/").status_code == 404
    assert APIClient().post(f"/api/resumes/{own.id}/parse/").status_code == 401


@pytest.mark.django_db
def test_profile_application_is_explicit_and_preserves_unselected_fields(client, owner):
    resume = make_resume(owner); parse_resume(resume.id)
    response = client.post(f"/api/resumes/{resume.id}/parsed/apply/", {"apply_skills": True, "apply_experience": False, "apply_current_job": False}, format="json")
    owner.candidate_profile.refresh_from_db()
    assert response.status_code == 200
    assert owner.candidate_profile.skills == ["Python", "Django"]
    assert owner.candidate_profile.current_company == "Manual Co"
    assert owner.candidate_profile.headline == "Keep me"


@pytest.mark.django_db
def test_replacing_file_invalidates_parsed_data(client, owner):
    resume = make_resume(owner); parse_resume(resume.id)
    replacement = text_pdf(["Skills", "Go"])
    response = client.patch(f"/api/resumes/{resume.id}/", {"file": SimpleUploadedFile("new.pdf", replacement, content_type="application/pdf")}, format="multipart")
    assert response.status_code == 200
    assert not ResumeParsedData.objects.filter(resume=resume).exists()
    assert response.data["parsing_status"] is None
