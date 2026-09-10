from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.services import create_interview_notification

from .models import Interview
from .serializers import InterviewReadSerializer, InterviewStatusSerializer, InterviewWriteSerializer


class InterviewPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


def _boolean_filter(params, name):
    value = params.get(name)
    if value is None:
        return False
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no", ""}:
        return False
    raise ValidationError({name: "Use true or false."})


class OwnedInterviewMixin:
    def get_queryset(self):
        return Interview.objects.filter(application__candidate__user=self.request.user).select_related(
            "application", "application__candidate", "application__job"
        )


class InterviewListCreateView(OwnedInterviewMixin, ListCreateAPIView):
    pagination_class = InterviewPagination
    http_method_names = ("get", "post", "head", "options")

    def get_serializer_class(self):
        return InterviewWriteSerializer if self.request.method == "POST" else InterviewReadSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        upcoming = _boolean_filter(self.request.query_params, "upcoming")
        past = _boolean_filter(self.request.query_params, "past")
        if upcoming and past:
            raise ValidationError({"upcoming": "Upcoming and past filters cannot both be true."})
        if upcoming:
            queryset = queryset.filter(scheduled_at__gte=timezone.now())
        elif past:
            queryset = queryset.filter(scheduled_at__lt=timezone.now())
        status_filter = self.request.query_params.get("status")
        if status_filter:
            if status_filter not in Interview.Status.values:
                raise ValidationError({"status": "Select a valid interview status."})
            queryset = queryset.filter(status=status_filter)
        return queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interview = serializer.save()
        create_interview_notification(interview, Notification.Type.INTERVIEW_SCHEDULED)
        return Response(
            InterviewReadSerializer(interview, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


class InterviewDetailView(OwnedInterviewMixin, RetrieveUpdateAPIView):
    http_method_names = ("get", "patch", "head", "options")

    def get_serializer_class(self):
        return InterviewWriteSerializer if self.request.method == "PATCH" else InterviewReadSerializer

    def update(self, request, *args, **kwargs):
        interview = self.get_object()
        serializer = self.get_serializer(interview, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        interview = serializer.save()
        return Response(InterviewReadSerializer(interview, context=self.get_serializer_context()).data)


class InterviewStatusView(OwnedInterviewMixin, APIView):
    @transaction.atomic
    def post(self, request, pk):
        try:
            interview = self.get_queryset().select_for_update().get(pk=pk)
        except Interview.DoesNotExist as exc:
            raise NotFound("Interview not found.") from exc
        serializer = InterviewStatusSerializer(
            data=request.data,
            context={"interview": interview},
        )
        serializer.is_valid(raise_exception=True)
        interview.status = serializer.validated_data["status"]
        update_fields = ["status", "updated_at"]
        if interview.status == Interview.Status.RESCHEDULED:
            interview.scheduled_at = serializer.validated_data["scheduled_at"]
            update_fields.append("scheduled_at")
        interview.save(update_fields=update_fields)
        notification_types = {
            Interview.Status.COMPLETED: Notification.Type.INTERVIEW_COMPLETED,
            Interview.Status.CANCELLED: Notification.Type.INTERVIEW_CANCELLED,
            Interview.Status.RESCHEDULED: Notification.Type.INTERVIEW_RESCHEDULED,
        }
        create_interview_notification(interview, notification_types[interview.status])
        return Response(InterviewReadSerializer(interview, context={"request": request}).data)
