from django.urls import path

from .views import ApplicationDetailView, ApplicationListCreateView, ApplicationWithdrawView, CoverLetterGenerateView

app_name = "applications"

urlpatterns = [
    path("", ApplicationListCreateView.as_view(), name="list-create"),
    path("cover-letter/generate/", CoverLetterGenerateView.as_view(), name="cover-letter-generate"),
    path("<int:pk>/", ApplicationDetailView.as_view(), name="detail"),
    path("<int:pk>/withdraw/", ApplicationWithdrawView.as_view(), name="withdraw"),
]
