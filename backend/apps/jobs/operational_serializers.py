from rest_framework import serializers

from .models import IngestionRun


class IngestionRunSerializer(serializers.ModelSerializer):
    duration_seconds = serializers.SerializerMethodField()

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


class ProviderSummarySerializer(serializers.Serializer):
    provider = serializers.CharField()
    last_successful_run = IngestionRunSerializer(allow_null=True)
    last_failed_run = IngestionRunSerializer(allow_null=True)
    running_run = IngestionRunSerializer(allow_null=True)
    last_success_duration_seconds = serializers.FloatField(allow_null=True)
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
