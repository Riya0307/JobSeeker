from rest_framework import serializers

from .models import Job


class JobSerializer(serializers.ModelSerializer):
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = (
            "id",
            "title",
            "company_name",
            "description",
            "location",
            "employment_type",
            "work_mode",
            "experience_min",
            "experience_max",
            "salary_min",
            "salary_max",
            "skills",
            "application_url",
            "source",
            "source_job_id",
            "posted_at",
            "expires_at",
            "is_active",
            "is_saved",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_is_saved(self, obj):
        if hasattr(obj, "is_saved_for_candidate"):
            return obj.is_saved_for_candidate
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return False
        return obj.saved_by.filter(candidate__user=request.user).exists()
