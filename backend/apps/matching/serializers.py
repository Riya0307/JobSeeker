from rest_framework import serializers

from apps.jobs.serializers import JobSerializer


class MatchResultSerializer(serializers.Serializer):
    job = JobSerializer(read_only=True)
    match_score = serializers.IntegerField(read_only=True, min_value=0, max_value=100)
    matched_skills = serializers.ListField(child=serializers.CharField(), read_only=True)
    missing_skills = serializers.ListField(child=serializers.CharField(), read_only=True)
    reasons = serializers.ListField(child=serializers.CharField(), read_only=True)
