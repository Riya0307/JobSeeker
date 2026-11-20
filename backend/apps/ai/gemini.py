import json
import logging
import socket
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


logger = logging.getLogger(__name__)
MAX_PROVIDER_BYTES = 256 * 1024


class GeminiUnavailable(Exception):
    pass


class GeminiRateLimited(GeminiUnavailable):
    pass


class GeminiInvalidResponse(GeminiUnavailable):
    pass


def generate_structured_json(prompt: str, response_schema: dict) -> dict:
    """Call the single configured Gemini transport and return its decoded JSON object."""
    if not settings.GEMINI_API_KEY:
        raise GeminiUnavailable("Gemini is not configured.")
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": settings.GEMINI_MAX_OUTPUT_TOKENS,
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        },
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent"
    request = Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": settings.GEMINI_API_KEY},
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.GEMINI_REQUEST_TIMEOUT) as response:
            raw_response = response.read(MAX_PROVIDER_BYTES + 1)
            if len(raw_response) > MAX_PROVIDER_BYTES:
                raise GeminiInvalidResponse("Gemini returned an invalid response.")
            provider_response = json.loads(raw_response.decode("utf-8"))
    except HTTPError as exc:
        logger.warning("Gemini request failed with HTTP status %s", exc.code)
        if exc.code == 429:
            raise GeminiRateLimited("Gemini is temporarily rate limited.") from exc
        raise GeminiUnavailable("Gemini is temporarily unavailable.") from exc
    except (URLError, socket.timeout, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("Gemini request failed: %s", type(exc).__name__)
        raise GeminiUnavailable("Gemini is temporarily unavailable.") from exc
    try:
        text = provider_response["candidates"][0]["content"]["parts"][0]["text"]
        value = json.loads(text)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
        raise GeminiInvalidResponse("Gemini returned an invalid response.") from exc
    if not isinstance(value, dict):
        raise GeminiInvalidResponse("Gemini returned an invalid response.")
    return value
