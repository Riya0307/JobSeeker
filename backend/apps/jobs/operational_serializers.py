from rest_framework import serializers

from .models import IngestionRun
from .operations import run_quality_metrics


class IngestionRunSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.SerializerMethodField()
    accepted_count = serializers.SerializerMethodField()
    acceptance_rate = serializers.SerializerMethodField()
    rejection_rate = serializers.SerializerMethodField()

    class Meta:
        model = IngestionRun
        fields = (
            "id",
            "provider",
            "trigger",
            "status",
            "started_at",
            "finished_at",
            "duration_seconds",
            "accepted_count",
            "acceptance_rate",
            "rejection_rate",
            "full_snapshot",
            "fetched_count",
            "processed_count",
            "created_count",
            "updated_count",
            "unchanged_count",
            "rejected_count",
            "deactivated_count",
            "rejection_reasons",
            "error_message",
        )
        read_only_fields = fields

    def get_duration_seconds(self, obj):
        if obj.finished_at is None:
            return None
        return round((obj.finished_at - obj.started_at).total_seconds(), 3)

    def get_accepted_count(self, obj):
        return run_quality_metrics(obj)["accepted_count"]

    def get_acceptance_rate(self, obj):
        return run_quality_metrics(obj)["acceptance_rate"]

    def get_rejection_rate(self, obj):
        return run_quality_metrics(obj)["rejection_rate"]


class ProviderSummarySerializer(serializers.Serializer):
    provider = serializers.CharField()
    latest_run = IngestionRunSerializer(allow_null=True)
    last_successful_run = IngestionRunSerializer(allow_null=True)
    last_failed_run = IngestionRunSerializer(allow_null=True)
    running_run = IngestionRunSerializer(allow_null=True)
    last_success_duration_seconds = serializers.FloatField(allow_null=True)
    last_success_at = serializers.DateTimeField(allow_null=True)
    last_success_age_seconds = serializers.FloatField(allow_null=True)
    latest_run_status = serializers.CharField(allow_null=True)
    latest_error = serializers.CharField(allow_null=True)
    latest_provider_job_seen_at = serializers.DateTimeField(allow_null=True)
    active_job_count = serializers.IntegerField()
    inactive_job_count = serializers.IntegerField()


class ProviderHealthSerializer(serializers.Serializer):
    provider = serializers.CharField()
    status = serializers.ChoiceField(choices=("healthy", "warning", "failed"))
    conditions = serializers.ListField(child=serializers.CharField())
    last_success_at = serializers.DateTimeField(allow_null=True)
    last_failure_at = serializers.DateTimeField(allow_null=True)
    running = serializers.BooleanField()
    stale = serializers.BooleanField()
    rejection_rate = serializers.FloatField(allow_null=True)
    active_job_count = serializers.IntegerField()
    inactive_job_count = serializers.IntegerField()
