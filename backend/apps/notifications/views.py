from django.db import transaction
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class OwnedNotificationMixin:
    def get_queryset(self):
        return Notification.objects.filter(candidate__user=self.request.user)


class NotificationListView(OwnedNotificationMixin, ListAPIView):
    serializer_class = NotificationSerializer
    pagination_class = NotificationPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        unread = self.request.query_params.get("unread")
        if unread is None or unread.strip().lower() in {"false", "0", "no", ""}:
            return queryset
        if unread.strip().lower() in {"true", "1", "yes"}:
            return queryset.filter(is_read=False)
        raise ValidationError({"unread": "Use true or false."})


class NotificationDetailView(OwnedNotificationMixin, RetrieveAPIView):
    serializer_class = NotificationSerializer
    http_method_names = ("get", "head", "options")


class NotificationReadView(OwnedNotificationMixin, APIView):
    def post(self, request, pk):
        notification = self.get_object(pk)
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=("is_read",))
        return Response(NotificationSerializer(notification).data)

    def get_object(self, pk):
        from rest_framework.exceptions import NotFound

        try:
            return self.get_queryset().get(pk=pk)
        except Notification.DoesNotExist as exc:
            raise NotFound("Notification not found.") from exc


class NotificationReadAllView(OwnedNotificationMixin, APIView):
    @transaction.atomic
    def post(self, request):
        updated_count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"updated_count": updated_count})
