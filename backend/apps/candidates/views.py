from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CandidateProfile
from .serializers import CandidateProfileSerializer


class CandidateProfileView(APIView):
    def get_profile(self, user):
        profile, _ = CandidateProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        serializer = CandidateProfileSerializer(self.get_profile(request.user))
        return Response({"data": serializer.data})

    def patch(self, request):
        serializer = CandidateProfileSerializer(
            self.get_profile(request.user), data=request.data, partial=True
        )
        if not serializer.is_valid():
            return Response({"errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"message": "Profile updated successfully.", "data": serializer.data})
