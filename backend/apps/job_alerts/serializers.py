from django.db import transaction
from rest_framework import serializers

from apps.candidates.models import CandidateProfile
from apps.matching.services import normalize_skill

from .models import JobAlert, MAX_ALERT_SKILLS


MAX_ACTIVE_ALERTS = 10
SERVER_CONTROLLED_FIELDS = {
    "candidate",
    "candidate_id",
    "user",
    "user_id",
    "created_at",
    "updated_at",
    "last_checked_at",
}


class JobAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobAlert
        fields = (
            "id",
            "name",
            "keywords",
            "location",
            "work_mode",
            "employment_type",
            "experience_min",
            "experience_max",
            "salary_min",
            "salary_max",
            "skills",
            "is_active",
            "created_at",
            "updated_at",
            "last_checked_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "last_checked_at")
        extra_kwargs = {
            "name": {"required": False, "allow_blank": True},
            "keywords": {"required": False, "allow_blank": True},
            "location": {"required": False, "allow_blank": True},
            "work_mode": {"required": False, "allow_blank": True},
            "employment_type": {"required": False, "allow_blank": True},
            "skills": {"required": False},
            "is_active": {"required": False},
        }

    def validate(self, attrs):
        forbidden = SERVER_CONTROLLED_FIELDS.intersection(self.initial_data)
        if forbidden:
            raise serializers.ValidationError(
                {field: "This field is controlled by the server." for field in forbidden}
            )

        values = {
            field: attrs.get(field, getattr(self.instance, field, None))
            for field in (
                "keywords",
                "location",
                "work_mode",
                "employment_type",
                "experience_min",
                "experience_max",
                "salary_min",
                "salary_max",
                "skills",
                "is_active",
            )
        }
        if values["experience_min"] is not None and values["experience_max"] is not None:
            if values["experience_min"] > values["experience_max"]:
                raise serializers.ValidationError(
                    {"experience_max": "Maximum experience must be at least the minimum."}
                )
        if values["salary_min"] is not None and values["salary_max"] is not None:
            if values["salary_min"] > values["salary_max"]:
                raise serializers.ValidationError(
                    {"salary_max": "Maximum salary must be at least the minimum."}
                )
        skills = values["skills"] if values["skills"] is not None else []
        if not isinstance(skills, list) or not all(isinstance(skill, str) for skill in skills):
            raise serializers.ValidationError({"skills": "Skills must be a list of strings."})
        if len(skills) > MAX_ALERT_SKILLS:
            raise serializers.ValidationError(
                {"skills": f"An alert can contain at most {MAX_ALERT_SKILLS} skills."}
            )
        normalized = set()
        display_skills = []
        for skill in skills:
            display = " ".join(skill.split())
            key = normalize_skill(display)
            if key and key not in normalized:
                normalized.add(key)
                display_skills.append(display)
        values["skills"] = display_skills
        if not any(
            (
                str(values["keywords"] or "").strip(),
                str(values["location"] or "").strip(),
                values["work_mode"],
                values["employment_type"],
                values["experience_min"] is not None,
                values["experience_max"] is not None,
                values["salary_min"] is not None,
                values["salary_max"] is not None,
                bool(display_skills),
            )
        ):
            raise serializers.ValidationError(
                {"criteria": "Provide at least one job alert criterion."}
            )

        attrs["name"] = str(attrs.get("name", getattr(self.instance, "name", "Job Alert"))).strip() or "Job Alert"
        for field in ("keywords", "location"):
            if field in attrs:
                attrs[field] = " ".join(attrs[field].split())
        if "employment_type" in attrs:
            attrs["employment_type"] = attrs["employment_type"].lower()
        if "skills" in attrs:
            attrs["skills"] = display_skills
        return attrs

    def _locked_candidate(self):
        try:
            candidate = CandidateProfile.objects.get(user=self.context["request"].user)
        except CandidateProfile.DoesNotExist as exc:
            raise serializers.ValidationError(
                {"candidate": "Create your candidate profile before creating an alert."}
            ) from exc
        return CandidateProfile.objects.select_for_update().get(pk=candidate.pk)

    def _enforce_active_limit(self, candidate, exclude_id=None):
        active = JobAlert.objects.filter(candidate=candidate, is_active=True)
        if exclude_id is not None:
            active = active.exclude(pk=exclude_id)
        if active.count() >= MAX_ACTIVE_ALERTS:
            raise serializers.ValidationError(
                {"is_active": f"You can have at most {MAX_ACTIVE_ALERTS} active job alerts."}
            )

    @transaction.atomic
    def create(self, validated_data):
        candidate = self._locked_candidate()
        if validated_data.get("is_active", True):
            self._enforce_active_limit(candidate)
        return JobAlert.objects.create(candidate=candidate, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        candidate = self._locked_candidate()
        if validated_data.get("is_active", instance.is_active) and not instance.is_active:
            self._enforce_active_limit(candidate, exclude_id=instance.pk)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
