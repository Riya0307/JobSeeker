from django.urls import path

from config import views

urlpatterns = [
    path("", views.health_check, name="health-check"),
]
