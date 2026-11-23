from django.urls import path

from .views import InterviewDetailView, InterviewListCreateView, InterviewPreparationView, InterviewStatusView

app_name = "interviews"

urlpatterns = [
    path("", InterviewListCreateView.as_view(), name="list-create"),
    path("<int:pk>/", InterviewDetailView.as_view(), name="detail"),
    path("<int:pk>/status/", InterviewStatusView.as_view(), name="status"),
    path("<int:pk>/prepare/", InterviewPreparationView.as_view(), name="prepare"),
]
