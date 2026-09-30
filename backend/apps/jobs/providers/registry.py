from types import MappingProxyType

from .arbeitnow import ArbeitnowProviderAdapter
from .base import JobProviderAdapter


class UnknownProviderError(ValueError):
    pass


def normalize_provider_identifier(value: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise UnknownProviderError("Provider identifier is required.")
    return value.strip().casefold()


_PROVIDERS = MappingProxyType(
    {
        ArbeitnowProviderAdapter.identifier: ArbeitnowProviderAdapter(),
    }
)


def get_provider(identifier: str) -> JobProviderAdapter:
    normalized = normalize_provider_identifier(identifier)
    try:
        return _PROVIDERS[normalized]
    except KeyError as error:
        raise UnknownProviderError(f"Unknown job provider: {normalized}") from error


def provider_identifiers() -> tuple[str, ...]:
    return tuple(sorted(_PROVIDERS))

