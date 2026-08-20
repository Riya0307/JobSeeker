from django.urls import path

from .views import JobDetailView, JobListView, SaveJobView, SavedJobListView

app_name = "jobs"

urlpatterns = [
    path("", JobListView.as_view(), name="list"),
    path("saved/", SavedJobListView.as_view(), name="saved-list"),
    path("<int:pk>/", JobDetailView.as_view(), name="detail"),
    path("<int:pk>/save/", SaveJobView.as_view(), name="save"),
]
