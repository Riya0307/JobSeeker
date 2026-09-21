from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import JobAlert
from .serializers import JobAlertSerializer, MAX_ACTIVE_ALERTS


class JobAlertPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class JobAlertViewSet(viewsets.ModelViewSet):
    serializer_class = JobAlertSerializer
    pagination_class = JobAlertPagination
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return JobAlert.objects.none()
        return JobAlert.objects.filter(candidate__user=self.request.user)

    @action(detail=True, methods=("post",))
    @transaction.atomic
    def toggle(self, request, pk=None):
        alert = self.get_queryset().select_for_update().select_related("candidate").filter(pk=pk).first()
        if alert is None:
            from rest_framework.exceptions import NotFound

            raise NotFound("Job alert not found.")
        if not alert.is_active:
            candidate = alert.candidate.__class__.objects.select_for_update().get(pk=alert.candidate_id)
            active_count = JobAlert.objects.filter(candidate=candidate, is_active=True).exclude(pk=alert.pk).count()
            if active_count >= MAX_ACTIVE_ALERTS:
                raise ValidationError(
                    {"is_active": f"You can have at most {MAX_ACTIVE_ALERTS} active job alerts."}
                )
        alert.is_active = not alert.is_active
        alert.save(update_fields=("is_active", "updated_at"))
        return Response(self.get_serializer(alert).data, status=status.HTTP_200_OK)
