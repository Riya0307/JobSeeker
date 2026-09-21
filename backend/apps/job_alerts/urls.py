from rest_framework.routers import SimpleRouter

from .views import JobAlertViewSet

app_name = "job_alerts"

router = SimpleRouter()
router.register("", JobAlertViewSet, basename="job-alert")

urlpatterns = router.urls
