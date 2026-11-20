from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle

from apps.ai.gemini import GeminiRateLimited, GeminiUnavailable

from apps.notifications.models import Notification
from apps.notifications.services import create_application_notification

from .models import Application
from .serializers import ApplicationCreateSerializer, ApplicationReadSerializer, CoverLetterGenerateSerializer
from .cover_letters import generate_cover_letter


class ApplicationPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class OwnedApplicationMixin:
    def get_queryset(self):
        return Application.objects.filter(candidate__user=self.request.user).select_related(
            "candidate", "job", "resume"
        )


class ApplicationListCreateView(OwnedApplicationMixin, ListCreateAPIView):
    pagination_class = ApplicationPagination
    http_method_names = ("get", "post", "head", "options")

    def get_serializer_class(self):
        return ApplicationCreateSerializer if self.request.method == "POST" else ApplicationReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                application = serializer.save()
                create_application_notification(
                    application, Notification.Type.APPLICATION_SUBMITTED
                )
        except IntegrityError as exc:
            raise ValidationError(
                {"job_id": "You have already applied to this job."}
            ) from exc
        output = ApplicationReadSerializer(application, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)


class ApplicationDetailView(OwnedApplicationMixin, RetrieveAPIView):
    serializer_class = ApplicationReadSerializer
    http_method_names = ("get", "head", "options")


class ApplicationWithdrawView(OwnedApplicationMixin, APIView):
    @transaction.atomic
    def post(self, request, pk):
        try:
            application = self.get_queryset().select_for_update().get(pk=pk)
        except Application.DoesNotExist:
            from rest_framework.exceptions import NotFound

            raise NotFound("Application not found.")
        if application.status == Application.Status.WITHDRAWN:
            raise ValidationError({"status": "This application has already been withdrawn."})
        if application.status != Application.Status.APPLIED:
            raise ValidationError({"status": "This application can no longer be withdrawn."})
        application.status = Application.Status.WITHDRAWN
        application.withdrawn_at = timezone.now()
        application.save(update_fields=("status", "withdrawn_at", "updated_at"))
        create_application_notification(
            application, Notification.Type.APPLICATION_WITHDRAWN
        )
        return Response(ApplicationReadSerializer(application, context={"request": request}).data)


class CoverLetterGenerateView(APIView):
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "cover_letter_generation"

    def post(self, request):
        serializer = CoverLetterGenerateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            result_status, result = generate_cover_letter(
                values["candidate"], values["job"], values["tone"], values["instructions"]
            )
        except GeminiRateLimited as exc:
            return Response(
                {"status": "unavailable", "cover_letter": None, "detail": str(exc)},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        except GeminiUnavailable as exc:
            return Response(
                {"status": "unavailable", "cover_letter": None, "detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if result_status == "processing":
            return Response(
                {"status": "processing", "cover_letter": None, "detail": "A matching draft is already being generated. Please retry shortly."},
                status=status.HTTP_202_ACCEPTED,
            )
        return Response(
            {"status": "generated", "cover_letter": result.cover_letter, "detail": ""}
        )
