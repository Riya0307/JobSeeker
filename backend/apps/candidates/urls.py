from django.urls import path

from .views import CandidateProfileView

app_name = "candidates"

urlpatterns = [path("", CandidateProfileView.as_view(), name="profile")]
