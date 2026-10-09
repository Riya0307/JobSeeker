from pathlib import Path

from django.conf import settings
from rest_framework import serializers

from .models import Resume, ResumeParsedData


DEFAULT_MAX_RESUME_SIZE = 5 * 1024 * 1024


class ResumeSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True, required=False)
    parsing_status = serializers.SerializerMethodField()

    class Meta:
        model = Resume
        fields = (
            "id",
            "title",
            "file",
            "file_name",
            "file_type",
            "file_size",
            "is_primary",
            "created_at",
            "updated_at",
            "parsing_status",
        )
        read_only_fields = (
            "id",
            "file_name",
            "file_type",
            "file_size",
            "created_at",
            "updated_at",
        )

    def get_parsing_status(self, instance):
        try:
            return instance.parsed_data.status
        except ResumeParsedData.DoesNotExist:
            return None

    def validate(self, attrs):
        upload = attrs.get("file")
        if self.instance is None and upload is None:
            raise serializers.ValidationError({"file": "A PDF resume is required."})
        return attrs

    def validate_file(self, upload):
        if not upload.name or Path(upload.name).suffix.lower() != ".pdf":
            raise serializers.ValidationError("Only files with a .pdf extension are allowed.")
        if upload.content_type != "application/pdf":
            raise serializers.ValidationError("The file content type must be application/pdf.")
        if upload.size <= 0:
            raise serializers.ValidationError("The uploaded PDF cannot be empty.")
        max_size = getattr(settings, "RESUME_MAX_FILE_SIZE", DEFAULT_MAX_RESUME_SIZE)
        if upload.size > max_size:
            raise serializers.ValidationError(
                f"The uploaded PDF cannot exceed {max_size // (1024 * 1024)} MB."
            )

        position = upload.tell()
        signature = upload.read(5)
        upload.seek(position)
        if signature != b"%PDF-":
            raise serializers.ValidationError("The uploaded file is not a valid PDF.")
        return upload

    @staticmethod
    def metadata_for(upload):
        return {
            "file_name": Path(upload.name).name[:255],
            "file_type": upload.content_type,
            "file_size": upload.size,
        }

    def create(self, validated_data):
        upload = validated_data["file"]
        return Resume.objects.create(**validated_data, **self.metadata_for(upload))

    def update(self, instance, validated_data):
        upload = validated_data.get("file")
        if upload is not None:
            validated_data.update(self.metadata_for(upload))
        return super().update(instance, validated_data)


class ResumeParsedDataSerializer(serializers.ModelSerializer):
    estimated_experience_years = serializers.SerializerMethodField()
    has_extracted_text = serializers.SerializerMethodField()

    class Meta:
        model = ResumeParsedData
        fields = (
            "status", "parser_version", "skills", "job_titles", "companies",
            "employment_history", "education", "projects", "certifications",
            "estimated_experience_months", "estimated_experience_years",
            "has_extracted_text", "parsing_error", "extracted_at", "updated_at",
        )
        read_only_fields = fields

    def get_estimated_experience_years(self, instance):
        if instance.estimated_experience_months is None:
            return None
        return round(instance.estimated_experience_months / 12, 1)

    def get_has_extracted_text(self, instance):
        return bool(instance.extracted_text.strip())


class ApplyParsedDataSerializer(serializers.Serializer):
    apply_skills = serializers.BooleanField(default=False)
    apply_experience = serializers.BooleanField(default=False)
    apply_current_job = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if not any(attrs.values()):
            raise serializers.ValidationError("Select at least one field to apply.")
        return attrs
