from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound
from rest_framework.generics import GenericAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.candidates.models import CandidateProfile
from apps.jobs.models import SavedJob

from .serializers import MatchResultSerializer
from .services import available_jobs, calculate_match


class MatchPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class CandidateMatchMixin:
    def get_candidate(self):
        try:
            return CandidateProfile.objects.get(user=self.request.user)
        except CandidateProfile.DoesNotExist as exc:
            raise NotFound("Candidate profile not found.") from exc

    def get_jobs(self, candidate):
        saved = SavedJob.objects.filter(job=OuterRef("pk"), candidate=candidate)
        return available_jobs().annotate(is_saved_for_candidate=Exists(saved))


class MatchedJobListView(CandidateMatchMixin, GenericAPIView):
    serializer_class = MatchResultSerializer
    pagination_class = MatchPagination

    def get(self, request):
        candidate = self.get_candidate()
        results = [calculate_match(candidate, job) for job in self.get_jobs(candidate)]
        results.sort(key=lambda result: (-result.match_score, -result.job.id))
        page = self.paginate_queryset(results)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class MatchedJobDetailView(CandidateMatchMixin, GenericAPIView):
    serializer_class = MatchResultSerializer

    def get(self, request, job_id):
        candidate = self.get_candidate()
        job = get_object_or_404(self.get_jobs(candidate), pk=job_id)
        return Response(self.get_serializer(calculate_match(candidate, job)).data)
