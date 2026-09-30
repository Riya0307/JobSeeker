from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Protocol, runtime_checkable


@dataclass(frozen=True)
class ProviderCapabilities:
    supports_full_snapshot: bool = False
    supports_stale_deactivation: bool = False


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


@runtime_checkable
class JobProviderAdapter(Protocol):
    """Small contract required by the provider-agnostic ingestion runner."""

    identifier: str
    max_batch_size: int
    capabilities: ProviderCapabilities
    record_error_types: tuple[type[Exception], ...]
    full_snapshot_error: str

    @property
    def default_limit(self) -> int: ...

    @property
    def max_retries(self) -> int: ...

    @property
    def retry_backoff_seconds(self) -> int: ...

    def fetch_records(self, limit: int) -> list[Mapping[str, Any]]: ...

    def record_identifier(self, record: Any) -> str: ...

    def map_record(self, record: Mapping[str, Any]) -> tuple[str, dict[str, Any]]: ...

    def is_transient_error(self, error: Exception) -> bool: ...

