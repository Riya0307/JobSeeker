import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any, Iterable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.jobs.models import Job
from apps.jobs.services import IngestionStatus, ingest_job


SOURCE = "arbeitnow"
API_URL = "https://www.arbeitnow.com/api/job-board-api"
MAX_BATCH_SIZE = 100
REQUEST_TIMEOUT_SECONDS = 15


class ArbeitnowProviderError(Exception):
    """Raised when the provider response cannot be fetched or understood."""


class ArbeitnowRecordError(ValueError):
    """Raised when one provider record cannot map to the internal contract."""


class _HTMLTextExtractor(HTMLParser):
    BLOCK_TAGS = {"br", "div", "li", "p", "section", "tr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)

    def text(self) -> str:
        lines = (" ".join(line.split()) for line in "".join(self.parts).splitlines())
        return "\n".join(line for line in lines if line)


@dataclass(frozen=True)
class RejectedJob:
    source_job_id: str
    reason: str


@dataclass
class BatchIngestionReport:
    fetched: int = 0
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    rejected: list[RejectedJob] = field(default_factory=list)

    @property
    def processed(self) -> int:
        return self.created + self.updated + self.unchanged + len(self.rejected)


def _plain_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    parser = _HTMLTextExtractor()
    parser.feed(value)
    parser.close()
    return parser.text()


def _provider_text(value: Any) -> str:
    """Decode provider entities and normalize harmless Unicode whitespace."""
    if not isinstance(value, str):
        return ""
    return " ".join(unescape(value).split())


def _required_text(record: Mapping[str, Any], field_name: str) -> str:
    value = _provider_text(record.get(field_name))
    if not value:
        raise ArbeitnowRecordError(f"{field_name} is required")
    return value


def _employment_type(record: Mapping[str, Any]) -> str:
    raw_types = record.get("job_types")
    if raw_types is None or raw_types == []:
        raise ArbeitnowRecordError("employment type is required")
    if not isinstance(raw_types, list):
        raise ArbeitnowRecordError("unsupported employment type")
    aliases = {
        "full time": "full-time",
        "full time permanent": "full-time",
        "internship": "internship",
    }
    observed_seniority_labels = {
        "berufserfahren",
        "experienced",
        "professional / experienced",
    }
    values = []
    for raw_type in raw_types:
        text = _provider_text(raw_type)
        if text:
            values.append(" ".join(re.sub(r"[_-]+", " ", text.casefold()).split()))
    if not values:
        raise ArbeitnowRecordError("employment type is required")

    mapped = {aliases[value] for value in values if value in aliases}
    unknown = [
        value for value in values if value not in aliases and value not in observed_seniority_labels
    ]
    if len(mapped) > 1 or (mapped and unknown) or (len(values) > 1 and unknown):
        raise ArbeitnowRecordError("ambiguous employment types")
    if mapped:
        return mapped.pop()
    raise ArbeitnowRecordError("unsupported employment type")


def _posted_at(record: Mapping[str, Any]) -> datetime:
    value = record.get("created_at")
    if isinstance(value, str) and value.isdigit():
        value = int(value)
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ArbeitnowRecordError("created_at must be a Unix timestamp")
    try:
        return datetime.fromtimestamp(value, tz=UTC)
    except (OverflowError, OSError, ValueError) as error:
        raise ArbeitnowRecordError("created_at is outside the supported range") from error


def map_job(record: Mapping[str, Any]) -> tuple[str, dict[str, Any]]:
    """Map one Arbeitnow record without duplicating core Job validation."""
    if not isinstance(record, Mapping):
        raise ArbeitnowRecordError("record must be an object")
    source_job_id = _required_text(record, "slug")
    description = _plain_text(record.get("description"))
    if not description:
        raise ArbeitnowRecordError("description is required")
    tags = record.get("tags", [])
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        raise ArbeitnowRecordError("tags must be a list of text values")
    tags = [_provider_text(tag) for tag in tags]
    remote = record.get("remote")
    if not isinstance(remote, bool):
        raise ArbeitnowRecordError("remote must be a boolean")

    return source_job_id, {
        "title": _required_text(record, "title"),
        "company_name": _required_text(record, "company_name"),
        "description": description,
        "location": _required_text(record, "location"),
        "employment_type": _employment_type(record),
        "work_mode": Job.WorkMode.REMOTE if remote else Job.WorkMode.ONSITE,
        "experience_min": None,
        "experience_max": None,
        "salary_min": None,
        "salary_max": None,
        "skills": tags,
        "application_url": _required_text(record, "url"),
        "posted_at": _posted_at(record),
        "expires_at": None,
        "is_active": True,
    }


def fetch_jobs(limit: int = 25) -> list[Mapping[str, Any]]:
    if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= MAX_BATCH_SIZE:
        raise ValueError(f"limit must be between 1 and {MAX_BATCH_SIZE}")
    request = Request(
        f"{API_URL}?{urlencode({'page': 1})}",
        headers={"Accept": "application/json", "User-Agent": "JobSeeker/1.0"},
    )
    try:
        with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            body = response.read()
    except (HTTPError, URLError, TimeoutError, OSError) as error:
        raise ArbeitnowProviderError(f"Unable to fetch Arbeitnow jobs: {error}") from error
    try:
        document = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ArbeitnowProviderError("Arbeitnow returned invalid JSON") from error
    jobs = document.get("data") if isinstance(document, dict) else None
    if not isinstance(jobs, list):
        raise ArbeitnowProviderError("Arbeitnow response does not contain a jobs list")
    return jobs[:limit]


def ingest_records(
    records: Iterable[Mapping[str, Any]],
    observed_at=None,
) -> BatchIngestionReport:
    observed_at = observed_at or timezone.now()
    report = BatchIngestionReport()
    for record in records:
        report.fetched += 1
        source_job_id = "unknown"
        if isinstance(record, Mapping) and isinstance(record.get("slug"), str):
            source_job_id = record["slug"]
        try:
            source_job_id, payload = map_job(record)
            result = ingest_job(SOURCE, source_job_id, payload)
            result.job.provider_last_seen_at = observed_at
            result.job.save(update_fields=("provider_last_seen_at", "updated_at"))
        except (ArbeitnowRecordError, ValidationError) as error:
            report.rejected.append(RejectedJob(source_job_id, str(error)))
            continue
        if result.status == IngestionStatus.CREATED:
            report.created += 1
        elif result.status == IngestionStatus.UPDATED:
            report.updated += 1
        else:
            report.unchanged += 1
    return report


def ingest_arbeitnow_jobs(limit: int = 25) -> BatchIngestionReport:
    return ingest_records(fetch_jobs(limit=limit))
