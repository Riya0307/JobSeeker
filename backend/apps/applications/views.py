from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Application
from .serializers import ApplicationCreateSerializer, ApplicationReadSerializer


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
        return Response(ApplicationReadSerializer(application, context={"request": request}).data)
