from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import IngestionRun
from .operational_serializers import (
    IngestionRunSerializer,
    ProviderHealthSerializer,
    ProviderSummarySerializer,
)
from .operations import provider_health, provider_names, provider_summary


class IngestionRunPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


def _date_bound(value: str, field_name: str, *, end=False):
    parsed = parse_datetime(value)
    if parsed is not None:
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed)
        return parsed
    date_value = parse_date(value)
    if date_value is not None:
        from datetime import datetime, time
        boundary = time.max if end else time.min
        return timezone.make_aware(datetime.combine(date_value, boundary))
    raise ValidationError({field_name: "Use an ISO-8601 date or datetime."})


class IngestionRunListView(ListAPIView):
    permission_classes = (IsAdminUser,)
    serializer_class = IngestionRunSerializer
    pagination_class = IngestionRunPagination

    def get_queryset(self):
        queryset = IngestionRun.objects.all().order_by("-started_at", "-id")
        params = self.request.query_params
        if provider := params.get("provider", "").strip():
            queryset = queryset.filter(provider=provider)
        if status := params.get("status", "").strip():
            if status not in IngestionRun.Status.values:
                raise ValidationError({"status": "Select a supported ingestion status."})
            queryset = queryset.filter(status=status)
        if value := params.get("started_after", "").strip():
            queryset = queryset.filter(started_at__gte=_date_bound(value, "started_after"))
        if value := params.get("started_before", "").strip():
            queryset = queryset.filter(
                started_at__lte=_date_bound(value, "started_before", end=True)
            )
        return queryset


class IngestionRunDetailView(RetrieveAPIView):
    permission_classes = (IsAdminUser,)
    serializer_class = IngestionRunSerializer
    queryset = IngestionRun.objects.all()


class IngestionSummaryView(APIView):
    permission_classes = (IsAdminUser,)

    def get(self, request):
        summaries = [
            provider_summary(provider)
            for provider in provider_names(request.query_params.get("provider"))
        ]
        return Response(ProviderSummarySerializer(summaries, many=True).data)


class IngestionHealthView(APIView):
    permission_classes = (IsAdminUser,)

    def get(self, request):
        health = [
            provider_health(provider)
            for provider in provider_names(request.query_params.get("provider"))
        ]
        return Response(ProviderHealthSerializer(health, many=True).data)
