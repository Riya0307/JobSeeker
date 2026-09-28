import json
from datetime import UTC, datetime
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.jobs.models import Job
from apps.jobs.providers.arbeitnow import (
    MAX_BATCH_SIZE,
    ArbeitnowProviderError,
    fetch_jobs,
    ingest_records,
    map_job,
)


def provider_job(**overrides):
    record = {
        "slug": "python-engineer-example-123",
        "company_name": "Example Ltd",
        "title": "Python Engineer",
        "description": "<p>Build <strong>Django</strong> APIs.</p><p>Ship software.</p>",
        "remote": True,
        "url": "https://www.arbeitnow.com/view/python-engineer-example-123",
        "tags": [" Python ", "PYTHON", "REST-API"],
        "job_types": ["Full-time"],
        "location": "Remote, Europe",
        "created_at": 1787217300,
    }
    record.update(overrides)
    return record


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.payload


def test_mapping_uses_provider_identity_and_only_available_data():
    source_job_id, payload = map_job(provider_job())

    assert source_job_id == "python-engineer-example-123"
    assert payload["description"] == "Build Django APIs.\nShip software."
    assert payload["work_mode"] == Job.WorkMode.REMOTE
    assert payload["employment_type"] == "full-time"
    assert payload["experience_min"] is payload["experience_max"] is None
    assert payload["salary_min"] is payload["salary_max"] is None
    assert payload["posted_at"] == datetime.fromtimestamp(1787217300, tz=UTC)
    assert payload["application_url"].startswith("https://www.arbeitnow.com/view/")


@pytest.mark.parametrize(
    "overrides",
    [
        {"slug": ""},
        {"title": None},
        {"description": "<p> </p>"},
        {"remote": "yes"},
        {"tags": "Python"},
        {"job_types": ["permanent"]},
        {"created_at": "yesterday"},
    ],
)
def test_mapping_rejects_records_that_cannot_meet_internal_contract(overrides):
    with pytest.raises(ValueError):
        map_job(provider_job(**overrides))


def test_fetch_is_bounded_and_uses_no_live_network(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return FakeResponse({"data": [provider_job(slug=str(index)) for index in range(5)]})

    monkeypatch.setattr("apps.jobs.providers.arbeitnow.urlopen", fake_urlopen)

    assert len(fetch_jobs(limit=2)) == 2
    assert captured["url"].startswith("https://www.arbeitnow.com/api/job-board-api?")
    assert captured["timeout"] > 0
    with pytest.raises(ValueError):
        fetch_jobs(limit=MAX_BATCH_SIZE + 1)


def test_fetch_rejects_invalid_provider_envelope(monkeypatch):
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.urlopen",
        lambda request, timeout: FakeResponse({"unexpected": []}),
    )
    with pytest.raises(ArbeitnowProviderError):
        fetch_jobs()


@pytest.mark.django_db
def test_batch_reports_created_unchanged_updated_and_rejected():
    first = ingest_records([provider_job(), provider_job(slug="", title="Invalid")])
    second = ingest_records([provider_job()])
    changed = ingest_records([provider_job(title="Senior Python Engineer")])

    assert (first.created, len(first.rejected)) == (1, 1)
    assert second.unchanged == 1
    assert changed.updated == 1
    job = Job.objects.get(source="arbeitnow", source_job_id="python-engineer-example-123")
    assert job.title == "Senior Python Engineer"
    assert job.skills == ["Python", "REST-API"]


@pytest.mark.django_db
def test_bad_record_does_not_prevent_later_batch_items():
    report = ingest_records(
        [provider_job(slug="bad", url="not a URL"), provider_job(slug="good")]
    )

    assert report.created == 1
    assert len(report.rejected) == 1
    assert Job.objects.filter(source="arbeitnow", source_job_id="good").exists()
    assert not Job.objects.filter(source="arbeitnow", source_job_id="bad").exists()


@pytest.mark.django_db
def test_management_command_reports_summary_without_live_network(monkeypatch):
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.urlopen",
        lambda request, timeout: FakeResponse({"data": [provider_job()]}),
    )
    stdout = StringIO()

    call_command("ingest_arbeitnow", limit=1, stdout=stdout)

    assert "created=1" in stdout.getvalue()
    assert "rejected=0" in stdout.getvalue()
    with pytest.raises(CommandError):
        call_command("ingest_arbeitnow", limit=0)
