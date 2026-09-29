from django.urls import path

from .operational_views import (
    IngestionHealthView,
    IngestionRunDetailView,
    IngestionRunListView,
    IngestionSummaryView,
)


app_name = "job-ingestion-operations"

urlpatterns = [
    path("runs/", IngestionRunListView.as_view(), name="run-list"),
    path("runs/<int:pk>/", IngestionRunDetailView.as_view(), name="run-detail"),
    path("summary/", IngestionSummaryView.as_view(), name="summary"),
    path("health/", IngestionHealthView.as_view(), name="health"),
]
