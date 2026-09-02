from django.urls import path

from .views import MatchedJobDetailView, MatchedJobListView

app_name = "matching"

urlpatterns = [
    path("jobs/", MatchedJobListView.as_view(), name="job-list"),
    path("jobs/<int:job_id>/", MatchedJobDetailView.as_view(), name="job-detail"),
]
