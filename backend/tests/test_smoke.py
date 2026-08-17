import pytest
from django.conf import settings


def test_django_project_loads():
    assert settings.SECRET_KEY
    assert "apps.accounts" in settings.INSTALLED_APPS


def test_health_check(client):
    response = client.get("/api/health/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
