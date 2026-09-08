from rest_framework import serializers

from apps.applications.models import Application
from apps.applications.serializers import ApplicationJobSerializer

from .models import Interview


class InterviewApplicationSerializer(serializers.ModelSerializer):
    job = ApplicationJobSerializer(read_only=True)

    class Meta:
        model = Application
        fields = ("id", "job")
        read_only_fields = fields


class InterviewReadSerializer(serializers.ModelSerializer):
    application = InterviewApplicationSerializer(read_only=True)

    class Meta:
        model = Interview
        fields = (
            "id",
            "application",
            "round_name",
            "scheduled_at",
            "duration_minutes",
            "mode",
            "meeting_link",
            "location",
            "notes",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class InterviewWriteSerializer(serializers.ModelSerializer):
    application_id = serializers.IntegerField(min_value=1, write_only=True, required=False)

    SERVER_CONTROLLED_FIELDS = {
        "candidate",
        "candidate_id",
        "user",
        "user_id",
        "owner_id",
        "status",
        "created_at",
        "updated_at",
    }

    class Meta:
        model = Interview
        fields = (
            "application_id",
            "round_name",
            "scheduled_at",
            "duration_minutes",
            "mode",
            "meeting_link",
            "location",
            "notes",
        )
        extra_kwargs = {
            "round_name": {"required": False},
            "scheduled_at": {"required": False},
            "duration_minutes": {"required": False},
            "mode": {"required": False},
        }

    def validate(self, attrs):
        forbidden = self.SERVER_CONTROLLED_FIELDS.intersection(self.initial_data)
        if self.instance is not None and "application_id" in self.initial_data:
            forbidden.add("application_id")
        if forbidden:
            raise serializers.ValidationError(
                {field: "This field is controlled by the server." for field in forbidden}
            )

        if self.instance is None:
            required = ("application_id", "round_name", "scheduled_at", "duration_minutes", "mode")
            missing = [field for field in required if field not in attrs]
            if missing:
                raise serializers.ValidationError({field: "This field is required." for field in missing})
            application_id = attrs.pop("application_id")
            application = Application.objects.filter(
                pk=application_id,
                candidate__user=self.context["request"].user,
            ).first()
            if application is None:
                raise serializers.ValidationError(
                    {"application_id": "Application not found or does not belong to you."}
                )
            attrs["application"] = application
        return attrs


class InterviewStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=(
            Interview.Status.COMPLETED,
            Interview.Status.CANCELLED,
            Interview.Status.RESCHEDULED,
        )
    )
    scheduled_at = serializers.DateTimeField(required=False)

    def validate(self, attrs):
        interview = self.context["interview"]
        if interview.status != Interview.Status.SCHEDULED:
            raise serializers.ValidationError(
                {"status": f"An interview with status '{interview.status}' cannot transition."}
            )
        if attrs["status"] == Interview.Status.RESCHEDULED and "scheduled_at" not in attrs:
            raise serializers.ValidationError(
                {"scheduled_at": "A new scheduled time is required when rescheduling."}
            )
        if attrs["status"] != Interview.Status.RESCHEDULED and "scheduled_at" in attrs:
            raise serializers.ValidationError(
                {"scheduled_at": "Scheduled time can only be supplied when rescheduling."}
            )
        return attrs
