from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.candidates.models import CandidateProfile

from .models import Resume, ResumeParsedData
from .serializers import ApplyParsedDataSerializer, ResumeParsedDataSerializer, ResumeSerializer


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
        replacing_file = "file" in serializer.validated_data
        self._save_with_primary_logic(serializer)
        new_file_name = serializer.instance.file.name
        if old_file_name and old_file_name != new_file_name:
            if replacing_file:
                ResumeParsedData.objects.filter(resume=serializer.instance).delete()
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

    @action(detail=True, methods=("post",), url_path="parse")
    def parse(self, request, pk=None):
        resume = self.get_object()
        from .parsing import PARSER_VERSION, compute_file_hash
        from .tasks import parse_resume_task

        file_hash = compute_file_hash(resume)
        parsed, created = ResumeParsedData.objects.get_or_create(
            resume=resume,
            defaults={"parser_version": PARSER_VERSION, "file_hash": file_hash},
        )
        if parsed.status == parsed.Status.COMPLETED and parsed.file_hash == file_hash and parsed.parser_version == PARSER_VERSION:
            return Response(ResumeParsedDataSerializer(parsed).data)
        if not created and parsed.status in {parsed.Status.PENDING, parsed.Status.PROCESSING} and parsed.file_hash == file_hash and parsed.parser_version == PARSER_VERSION:
            return Response(ResumeParsedDataSerializer(parsed).data, status=status.HTTP_202_ACCEPTED)
        parsed.status = parsed.Status.PENDING
        parsed.parser_version = PARSER_VERSION
        parsed.file_hash = file_hash
        parsed.parsing_error = ""
        parsed.save()
        try:
            parse_resume_task.delay(resume.id)
        except Exception:
            parsed.status = parsed.Status.FAILED
            parsed.parsing_error = "Resume parsing could not be queued. Please try again."
            parsed.save(update_fields=("status", "parsing_error", "updated_at"))
            return Response(ResumeParsedDataSerializer(parsed).data, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(ResumeParsedDataSerializer(parsed).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=("get",), url_path="parsed")
    def parsed(self, request, pk=None):
        resume = self.get_object()
        try:
            parsed = resume.parsed_data
        except ResumeParsedData.DoesNotExist:
            return Response({"detail": "This resume has not been parsed."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ResumeParsedDataSerializer(parsed).data)

    @action(detail=True, methods=("post",), url_path="parsed/apply")
    @transaction.atomic
    def apply_parsed(self, request, pk=None):
        resume = self.get_object()
        request_serializer = ApplyParsedDataSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        parsed = ResumeParsedData.objects.select_for_update().filter(
            resume=resume, status=ResumeParsedData.Status.COMPLETED
        ).first()
        if parsed is None:
            return Response({"detail": "Completed parsed data is not available."}, status=status.HTTP_409_CONFLICT)
        selected = request_serializer.validated_data
        current = next((item for item in parsed.employment_history if item.get("is_current")), None)
        unavailable = []
        if selected["apply_skills"] and not parsed.skills:
            unavailable.append("skills")
        if selected["apply_experience"] and parsed.estimated_experience_months is None:
            unavailable.append("experience")
        if selected["apply_current_job"] and not current:
            unavailable.append("current_job")
        if unavailable:
            return Response(
                {"detail": f"Selected parsed data is unavailable: {', '.join(unavailable)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        candidate = self._locked_candidate()
        fields = []
        if selected["apply_skills"]:
            candidate.skills = parsed.skills
            fields.append("skills")
        if selected["apply_experience"] and parsed.estimated_experience_months is not None:
            candidate.years_of_experience = parsed.estimated_experience_months // 12
            fields.append("years_of_experience")
        if selected["apply_current_job"] and current:
            candidate.current_job_title = current.get("title", "")[:255]
            candidate.current_company = current.get("company", "")[:255]
            fields.extend(("current_job_title", "current_company"))
        if fields:
            candidate.save(update_fields=tuple(dict.fromkeys(fields)) + ("updated_at",))
        return Response({"updated_fields": list(dict.fromkeys(fields))})
