from django.utils import timezone
from rest_framework import serializers

from apps.candidates.models import CandidateProfile
from apps.jobs.models import Job
from apps.resumes.models import Resume

from .models import Application


class ApplicationJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ("id", "title", "company_name", "location", "work_mode", "employment_type")
        read_only_fields = fields


class ApplicationResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ("id", "title", "file_name", "file_type", "file_size", "is_primary")
        read_only_fields = fields


class ApplicationReadSerializer(serializers.ModelSerializer):
    job = ApplicationJobSerializer(read_only=True)
    resume = ApplicationResumeSerializer(read_only=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "status",
            "job",
            "resume",
            "cover_letter",
            "applied_at",
            "updated_at",
            "withdrawn_at",
        )
        read_only_fields = fields


class ApplicationCreateSerializer(serializers.Serializer):
    job_id = serializers.IntegerField(min_value=1)
    resume_id = serializers.IntegerField(min_value=1, required=False)
    cover_letter = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=10000,
        trim_whitespace=True,
    )

    CLIENT_CONTROLLED_FIELDS = {
        "candidate",
        "candidate_id",
        "user",
        "user_id",
        "owner_id",
        "status",
        "applied_at",
        "updated_at",
        "withdrawn_at",
    }

    def validate(self, attrs):
        supplied_forbidden = self.CLIENT_CONTROLLED_FIELDS.intersection(self.initial_data)
        if supplied_forbidden:
            raise serializers.ValidationError(
                {field: "This field is controlled by the server." for field in supplied_forbidden}
            )

        user = self.context["request"].user
        try:
            candidate = CandidateProfile.objects.get(user=user)
        except CandidateProfile.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"candidate": "Create your candidate profile before applying."}
            ) from exc

        try:
            job = Job.objects.get(pk=attrs["job_id"])
        except Job.DoesNotExist as exc:
            raise serializers.ValidationError({"job_id": "Job not found."}) from exc
        if not job.is_active or (job.expires_at is not None and job.expires_at <= timezone.now()):
            raise serializers.ValidationError({"job_id": "This job is not accepting applications."})

        resume_id = attrs.get("resume_id")
        if resume_id is not None:
            resume = Resume.objects.filter(pk=resume_id, candidate=candidate).first()
            if resume is None:
                raise serializers.ValidationError(
                    {"resume_id": "Select one of your own resumes."}
                )
        else:
            resume = Resume.objects.filter(candidate=candidate, is_primary=True).first()
            if resume is None:
                raise serializers.ValidationError(
                    {"resume_id": "Select a resume or set a primary resume before applying."}
                )

        if Application.objects.filter(candidate=candidate, job=job).exists():
            raise serializers.ValidationError(
                {"job_id": "You have already applied to this job."}
            )
        attrs["candidate"] = candidate
        attrs["job"] = job
        attrs["resume"] = resume
        return attrs

    def create(self, validated_data):
        validated_data.pop("job_id")
        validated_data.pop("resume_id", None)
        return Application.objects.create(**validated_data)
