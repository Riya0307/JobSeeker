from django.urls import path

from .views import ApplicationDetailView, ApplicationListCreateView, ApplicationWithdrawView

app_name = "applications"

urlpatterns = [
    path("", ApplicationListCreateView.as_view(), name="list-create"),
    path("<int:pk>/", ApplicationDetailView.as_view(), name="detail"),
    path("<int:pk>/withdraw/", ApplicationWithdrawView.as_view(), name="withdraw"),
]
