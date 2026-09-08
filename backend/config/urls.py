from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/profile/", include("apps.candidates.urls")),
    path("api/resumes/", include("apps.resumes.urls")),
    path("api/jobs/", include("apps.jobs.urls")),
    path("api/matching/", include("apps.matching.urls")),
    path("api/applications/", include("apps.applications.urls")),
    path("api/interviews/", include("apps.interviews.urls")),
    path("api/health/", include("config.health_urls")),
]
