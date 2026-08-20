from django.db import IntegrityError
from django.db.models import Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.candidates.models import CandidateProfile

from .models import Job, SavedJob
from .serializers import JobSerializer


class JobPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


def _number_param(params, name, number_type=int):
    value = params.get(name)
    if value in (None, ""):
        return None
    try:
        parsed = number_type(value)
    except (TypeError, ValueError):
        raise ValidationError({name: "Must be a non-negative number."})
    if parsed < 0:
        raise ValidationError({name: "Must be a non-negative number."})
    return parsed


class JobQuerysetMixin:
    def base_queryset(self):
        candidate_id = CandidateProfile.objects.filter(user=self.request.user).values_list(
            "id", flat=True
        ).first()
        saved = SavedJob.objects.filter(job=OuterRef("pk"), candidate_id=candidate_id)
        return Job.objects.filter(is_active=True).annotate(is_saved_for_candidate=Exists(saved))


class JobListView(JobQuerysetMixin, ListAPIView):
    serializer_class = JobSerializer
    pagination_class = JobPagination

    def get_queryset(self):
        queryset = self.base_queryset()
        params = self.request.query_params

        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(company_name__icontains=search)
                | Q(description__icontains=search)
                | Q(location__icontains=search)
                | Q(skills__icontains=search)
            )
        if location := params.get("location", "").strip():
            queryset = queryset.filter(location__icontains=location)
        if work_mode := params.get("work_mode", "").strip():
            queryset = queryset.filter(work_mode__iexact=work_mode)
        if employment_type := params.get("employment_type", "").strip():
            queryset = queryset.filter(employment_type__iexact=employment_type)

        experience_min = _number_param(params, "experience_min")
        experience_max = _number_param(params, "experience_max")
        salary_min = _number_param(params, "salary_min")
        salary_max = _number_param(params, "salary_max")
        if experience_min is not None:
            queryset = queryset.filter(
                Q(experience_max__gte=experience_min) | Q(experience_max__isnull=True)
            )
        if experience_max is not None:
            queryset = queryset.filter(
                Q(experience_min__lte=experience_max) | Q(experience_min__isnull=True)
            )
        if salary_min is not None:
            queryset = queryset.filter(Q(salary_max__gte=salary_min) | Q(salary_max__isnull=True))
        if salary_max is not None:
            queryset = queryset.filter(Q(salary_min__lte=salary_max) | Q(salary_min__isnull=True))

        skills = [skill.strip() for skill in params.get("skills", "").split(",") if skill.strip()]
        for skill in skills:
            queryset = queryset.filter(skills__icontains=skill)

        ordering = params.get("ordering", "-posted_at")
        allowed = {
            "posted_at", "salary_min", "salary_max", "experience_min", "experience_max",
            "title", "company_name", "created_at",
        }
        fields = [field.strip() for field in ordering.split(",") if field.strip()]
        if not fields or any(field.lstrip("-") not in allowed for field in fields):
            raise ValidationError({"ordering": "Contains an unsupported ordering field."})
        return queryset.order_by(*fields, "-id")


class JobDetailView(JobQuerysetMixin, RetrieveAPIView):
    serializer_class = JobSerializer

    def get_queryset(self):
        return self.base_queryset()


class SavedJobListView(JobQuerysetMixin, ListAPIView):
    serializer_class = JobSerializer
    pagination_class = JobPagination

    def get_queryset(self):
        return self.base_queryset().filter(saved_by__candidate__user=self.request.user).order_by(
            "-saved_by__created_at", "-id"
        )


class SaveJobView(APIView):
    def post(self, request, pk):
        job = get_object_or_404(Job, pk=pk, is_active=True)
        candidate, _ = CandidateProfile.objects.get_or_create(user=request.user)
        try:
            _, created = SavedJob.objects.get_or_create(candidate=candidate, job=job)
        except IntegrityError:
            SavedJob.objects.get(candidate=candidate, job=job)
            created = False
        serializer = JobSerializer(job, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, pk):
        job = get_object_or_404(Job, pk=pk, is_active=True)
        SavedJob.objects.filter(candidate__user=request.user, job=job).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
