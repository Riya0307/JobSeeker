from rest_framework import serializers

from .models import CandidateProfile


class CandidateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateProfile
        fields = (
            "phone",
            "location",
            "headline",
            "bio",
            "years_of_experience",
            "current_job_title",
            "current_company",
            "skills",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_skills(self, value):
        if not isinstance(value, list) or not all(isinstance(skill, str) for skill in value):
            raise serializers.ValidationError("Skills must be a list of strings.")
        return [skill.strip() for skill in value if skill.strip()]
