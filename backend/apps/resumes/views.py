from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.candidates.models import CandidateProfile

from .models import Resume
from .serializers import ResumeSerializer


class ResumeViewSet(viewsets.ModelViewSet):
    serializer_class = ResumeSerializer
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Resume.objects.none()
        return Resume.objects.filter(candidate__user=self.request.user)

    def _locked_candidate(self):
        candidate, _ = CandidateProfile.objects.get_or_create(user=self.request.user)
        return CandidateProfile.objects.select_for_update().get(pk=candidate.pk)

    def _save_with_primary_logic(self, serializer):
        candidate = self._locked_candidate()
        if serializer.validated_data.get("is_primary") is True:
            Resume.objects.filter(candidate=candidate, is_primary=True).exclude(
                pk=getattr(serializer.instance, "pk", None)
            ).update(is_primary=False)
        serializer.save(candidate=candidate)

    @transaction.atomic
    def perform_create(self, serializer):
        self._save_with_primary_logic(serializer)

    @transaction.atomic
    def perform_update(self, serializer):
        old_file_name = serializer.instance.file.name
        self._save_with_primary_logic(serializer)
        new_file_name = serializer.instance.file.name
        if old_file_name and old_file_name != new_file_name:
            storage = serializer.instance.file.storage
            transaction.on_commit(lambda: storage.delete(old_file_name))

    @transaction.atomic
    def perform_destroy(self, instance):
        candidate = self._locked_candidate()
        was_primary = instance.is_primary
        stored_name = instance.file.name
        storage = instance.file.storage
        instance.delete()
        if was_primary:
            replacement = (
                Resume.objects.filter(candidate=candidate)
                .order_by("-updated_at", "-id")
                .first()
            )
            if replacement is not None:
                replacement.is_primary = True
                replacement.save(update_fields=("is_primary", "updated_at"))
        if stored_name:
            transaction.on_commit(lambda: storage.delete(stored_name))

    @action(detail=True, methods=("post",), url_path="set-primary")
    @transaction.atomic
    def set_primary(self, request, pk=None):
        candidate = self._locked_candidate()
        owned_resume = self.get_object()
        resume = self.get_queryset().select_for_update().get(pk=owned_resume.pk)
        Resume.objects.filter(candidate=candidate, is_primary=True).exclude(pk=resume.pk).update(
            is_primary=False
        )
        if not resume.is_primary:
            resume.is_primary = True
            resume.save(update_fields=("is_primary", "updated_at"))
        return Response(self.get_serializer(resume).data, status=status.HTTP_200_OK)
