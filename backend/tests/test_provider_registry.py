import importlib
from datetime import timedelta
from io import StringIO
from uuid import uuid4

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from apps.jobs.ingestion import (
    FullSnapshotNotVerified,
    IngestionAlreadyRunning,
    run_provider_ingestion,
)
from apps.jobs.models import IngestionRun, Job
from apps.jobs.providers.arbeitnow import (
    ArbeitnowProviderAdapter,
    ArbeitnowProviderError,
)
from apps.jobs.providers.base import JobProviderAdapter
from apps.jobs.providers.registry import (
    UnknownProviderError,
    get_provider,
    provider_identifiers,
)
from apps.jobs.tasks import ingest_provider_task


def provider_record(**overrides):
    record = {
        "slug": "registry-python-engineer",
        "company_name": "Example Ltd",
        "title": "Python Engineer",
        "description": "<p>Build Django APIs.</p>",
        "remote": True,
        "url": "https://www.arbeitnow.com/view/registry-python-engineer",
        "tags": ["Python", "Django"],
        "job_types": ["Full-time"],
        "location": "Remote, Europe",
        "created_at": 1787217300,
    }
    record.update(overrides)
    return record


def create_provider_job(**overrides):
    values = {
        "title": "Old provider job",
        "company_name": "Example Ltd",
        "description": "Previously imported.",
        "location": "Remote",
        "employment_type": "full-time",
        "work_mode": Job.WorkMode.REMOTE,
        "skills": ["Python"],
        "application_url": "https://example.com/apply",
        "source": "arbeitnow",
        "source_job_id": uuid4().hex,
        "posted_at": timezone.now(),
        "provider_last_seen_at": timezone.now() - timedelta(days=3),
        "is_active": True,
    }
    values.update(overrides)
    return Job.objects.create(**values)


def test_registry_is_deterministic_normalized_and_unknown_is_clear():
    assert provider_identifiers() == ("arbeitnow",)
    assert get_provider(" ArbeitNow ") is get_provider("arbeitnow")
    with pytest.raises(UnknownProviderError, match="Unknown job provider: missing"):
        get_provider("missing")


@pytest.mark.django_db
def test_generic_task_rejects_unknown_provider_without_creating_a_run():
    with pytest.raises(UnknownProviderError, match="Unknown job provider"):
        ingest_provider_task.run("missing", limit=1)
    assert not IngestionRun.objects.exists()


def test_registry_import_performs_no_network_io(monkeypatch):
    monkeypatch.setattr(
        "apps.jobs.providers.arbeitnow.urlopen",
        lambda *args, **kwargs: pytest.fail("registry import must not fetch"),
    )
    import apps.jobs.providers.registry as registry

    reloaded = importlib.reload(registry)
    assert reloaded.provider_identifiers() == ("arbeitnow",)


def test_arbeitnow_satisfies_contract_and_declares_safe_capabilities():
    adapter = get_provider("arbeitnow")
    assert isinstance(adapter, JobProviderAdapter)
    assert isinstance(adapter, ArbeitnowProviderAdapter)
    assert adapter.identifier == "arbeitnow"
    assert adapter.capabilities.supports_full_snapshot is False
    assert adapter.capabilities.supports_stale_deactivation is False
    source_id, payload = adapter.map_record(provider_record())
    assert source_id == "registry-python-engineer"
    assert payload["title"] == "Python Engineer"
    assert payload["skills"] == ["Python", "Django"]


@pytest.mark.django_db
def test_generic_runner_records_created_unchanged_updated_and_rejected(monkeypatch):
    adapter = get_provider("arbeitnow")
    records = [provider_record(), provider_record(slug="bad", location="")]
    monkeypatch.setattr(adapter, "fetch_records", lambda limit: records)
    first = run_provider_ingestion("arbeitnow", limit=2)

    monkeypatch.setattr(adapter, "fetch_records", lambda limit: [provider_record()])
    second = run_provider_ingestion("arbeitnow", limit=1)
    monkeypatch.setattr(
        adapter,
        "fetch_records",
        lambda limit: [provider_record(title="Senior Python Engineer")],
    )
    third = run_provider_ingestion("arbeitnow", limit=1)

    assert (first.run.created_count, first.run.rejected_count) == (1, 1)
    assert first.run.rejection_reasons == {"location required": 1}
    assert second.run.unchanged_count == 1
    assert third.run.updated_count == 1
    job = Job.objects.get(source="arbeitnow", source_job_id="registry-python-engineer")
    assert job.title == "Senior Python Engineer"
    assert job.provider_last_seen_at == third.run.started_at


@pytest.mark.django_db
def test_generic_runner_failure_marks_run_failed_and_releases_lock(monkeypatch):
    adapter = get_provider("arbeitnow")
    monkeypatch.setattr(
        adapter,
        "fetch_records",
        lambda limit: (_ for _ in ()).throw(ArbeitnowProviderError("bad envelope")),
    )
    with pytest.raises(ArbeitnowProviderError):
        run_provider_ingestion("arbeitnow", limit=1)
    run = IngestionRun.objects.get()
    assert run.status == IngestionRun.Status.FAILED
    assert run.running_lock is None
    assert "bad envelope" in run.error_message


@pytest.mark.django_db
def test_generic_runner_uses_existing_provider_lock(monkeypatch):
    IngestionRun.objects.create(
        provider="arbeitnow",
        status=IngestionRun.Status.RUNNING,
        running_lock="arbeitnow",
    )
    adapter = get_provider("arbeitnow")
    monkeypatch.setattr(adapter, "fetch_records", lambda limit: [])
    with pytest.raises(IngestionAlreadyRunning):
        run_provider_ingestion("arbeitnow", limit=1)
    assert IngestionRun.objects.count() == 1


@pytest.mark.django_db
def test_generic_task_lock_contention_is_a_clean_non_retrying_result():
    IngestionRun.objects.create(
        provider="arbeitnow",
        status=IngestionRun.Status.RUNNING,
        running_lock="arbeitnow",
    )
    result = ingest_provider_task.run("arbeitnow", limit=1)
    assert result["status"] == "already_running"
    assert result["retrying"] is False
    assert IngestionRun.objects.count() == 1


@pytest.mark.django_db
def test_empty_bounded_run_never_deactivates_unseen_job(monkeypatch):
    unseen = create_provider_job()
    adapter = get_provider("arbeitnow")
    monkeypatch.setattr(adapter, "fetch_records", lambda limit: [])

    execution = run_provider_ingestion("arbeitnow", limit=1)

    unseen.refresh_from_db()
    assert unseen.is_active is True
    assert execution.run.full_snapshot is False
    assert execution.run.deactivated_count == 0
    with pytest.raises(FullSnapshotNotVerified):
        run_provider_ingestion("arbeitnow", limit=1, full_snapshot=True)


@pytest.mark.django_db
def test_generic_management_command_and_compatibility_command(monkeypatch):
    adapter = get_provider("arbeitnow")
    monkeypatch.setattr(
        adapter, "fetch_records", lambda limit: [provider_record()]
    )
    generic_output = StringIO()
    call_command(
        "ingest_provider", " ArbeitNow ", limit=1, stdout=generic_output
    )
    assert "provider=arbeitnow" in generic_output.getvalue()
    assert "created=1" in generic_output.getvalue()
    with pytest.raises(CommandError, match="Unknown job provider"):
        call_command("ingest_provider", "missing", limit=1)
    with pytest.raises(CommandError, match="complete-snapshot"):
        call_command("ingest_provider", "arbeitnow", full_snapshot=True)
