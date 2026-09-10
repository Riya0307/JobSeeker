from django.urls import path

from .views import (
    NotificationDetailView,
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
)

app_name = "notifications"

urlpatterns = [
    path("", NotificationListView.as_view(), name="list"),
    path("read-all/", NotificationReadAllView.as_view(), name="read-all"),
    path("<int:pk>/", NotificationDetailView.as_view(), name="detail"),
    path("<int:pk>/read/", NotificationReadView.as_view(), name="read"),
]
