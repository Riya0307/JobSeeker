from rest_framework.routers import SimpleRouter

from .views import ResumeViewSet

app_name = "resumes"

router = SimpleRouter()
router.register("", ResumeViewSet, basename="resume")

urlpatterns = router.urls
