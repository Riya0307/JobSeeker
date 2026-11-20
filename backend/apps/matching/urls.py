from django.urls import path

from .views import MatchExplanationView, MatchedJobDetailView, MatchedJobListView

app_name = "matching"

urlpatterns = [
    path("jobs/", MatchedJobListView.as_view(), name="job-list"),
    path("jobs/<int:job_id>/", MatchedJobDetailView.as_view(), name="job-detail"),
    path("jobs/<int:job_id>/explanation/", MatchExplanationView.as_view(), name="job-explanation"),
]
