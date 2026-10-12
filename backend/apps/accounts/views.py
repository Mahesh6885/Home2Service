from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from .permissions import IsCustomer, IsWorker, IsApprovedWorker, IsAdminUserRole, IsOwnerOrAdmin
from .serializers import (
    CustomerRegistrationSerializer,
    WorkerRegistrationSerializer,
    UserPublicSerializer,
    WorkerProfileSerializer,
    WorkerApprovalSerializer,
    AddressSerializer,
    WorkerLocationUpdateSerializer
)

from .throttles import LoginRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    default_error_messages = {
        'no_active_account': 'Invalid credentials. Please verify your username and password.'
    }

    def validate(self, attrs):
        data = super().validate(attrs)
        # Append user metadata for frontend authentication state
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'phone_number': self.user.phone_number,
            'role': self.user.role,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
        }
        if self.user.role == UserRole.WORKER and hasattr(self.user, 'worker_profile'):
            profile = self.user.worker_profile
            data['worker_profile'] = {
                'id': profile.id,
                'approval_status': profile.approval_status,
                'is_available': profile.is_available,
                'is_active': profile.is_active,
                'service_radius_km': float(profile.service_radius_km),
                'is_eligible': profile.is_eligible_for_dispatch
            }
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]


class LogoutView(APIView):
    """
    Revokes the provided refresh token by adding it to the SimpleJWT blacklist.
    Clears server-side session state for the user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({"error": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({
                "message": "Successfully logged out. Refresh token has been revoked."
            }, status=status.HTTP_200_OK)
        except TokenError as e:
            return Response({"error": f"Invalid or expired token: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"error": "Failed to revoke token."}, status=status.HTTP_400_BAD_REQUEST)


class CustomerRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = CustomerRegistrationSerializer
    permission_classes = [permissions.AllowAny]


class WorkerRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = WorkerRegistrationSerializer
    permission_classes = [permissions.AllowAny]


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user_data = UserPublicSerializer(request.user).data
        if request.user.role == UserRole.WORKER and hasattr(request.user, 'worker_profile'):
            user_data['worker_profile'] = WorkerProfileSerializer(request.user.worker_profile).data
        return Response(user_data)

    def patch(self, request):
        serializer = UserPublicSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkerProfileManageView(generics.RetrieveUpdateAPIView):
    serializer_class = WorkerProfileSerializer
    permission_classes = [IsWorker]

    def get_object(self):
        profile, _ = WorkerProfile.objects.get_or_create(user=self.request.user)
        return profile


class WorkerAvailabilityToggleView(APIView):
    permission_classes = [IsWorker]

    def post(self, request):
        profile, _ = WorkerProfile.objects.get_or_create(user=request.user)
        # Workers can only be marked available if they are approved
        if profile.approval_status != WorkerApprovalStatus.APPROVED:
            return Response(
                {"error": "Only approved workers can toggle availability."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Explicit target or toggle
        target = request.data.get('is_available')
        if target is not None:
            profile.is_available = bool(target)
        else:
            profile.is_available = not profile.is_available
        profile.save()

        return Response({
            "is_available": profile.is_available,
            "message": f"Worker availability set to {'Available' if profile.is_available else 'Unavailable'}"
        })


class AddressListCreateView(generics.ListCreateAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsCustomer]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


class AddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AddressSerializer
    permission_classes = [IsCustomer, IsOwnerOrAdmin]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)


# Administrator Views
class AdminWorkerListView(generics.ListAPIView):
    serializer_class = WorkerProfileSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        queryset = WorkerProfile.objects.select_related('user').all().order_by('-created_at')
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(approval_status=status_param.upper())
        return queryset


class AdminWorkerApprovalActionView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request, worker_id):
        try:
            profile = WorkerProfile.objects.get(id=worker_id)
        except WorkerProfile.DoesNotExist:
            return Response({"error": "Worker profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkerApprovalSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            from apps.notifications.models import AuditEventType
            from apps.notifications.services import record_audit_event
            record_audit_event(
                event_type=AuditEventType.WORKER_APPROVAL_UPDATED,
                actor=request.user,
                outcome='SUCCESS',
                metadata={
                    'worker_id': profile.id,
                    'worker_username': profile.user.username,
                    'approval_status': profile.approval_status,
                    'approval_reason': profile.approval_reason
                }
            )
            return Response({
                "message": f"Worker status updated to {profile.approval_status}",
                "worker": WorkerProfileSerializer(profile).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkerLocationUpdateView(APIView):
    """
    Authenticated endpoint for approved workers to update their current GPS coordinates
    and manage location sharing status. Throttled to prevent abusive update frequency.
    """
    permission_classes = [IsApprovedWorker]

    def post(self, request):
        profile = getattr(request.user, 'worker_profile', None)
        if not profile:
            return Response({"error": "Worker profile not found."}, status=status.HTTP_404_NOT_FOUND)
        profile.refresh_from_db()

        from django.conf import settings
        from django.utils import timezone
        throttle_seconds = getattr(settings, 'WORKER_LOCATION_UPDATE_THROTTLE_SECONDS', 5)

        serializer = WorkerLocationUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        is_coord_update = 'latitude' in data and 'longitude' in data

        if is_coord_update and profile.last_location_updated_at:
            elapsed = (timezone.now() - profile.last_location_updated_at).total_seconds()
            if elapsed < throttle_seconds:
                return Response(
                    {"detail": f"Location updates are rate-limited. Please wait {max(1, int(throttle_seconds - elapsed))} seconds before updating again."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

        if is_coord_update:
            profile.latitude = data['latitude']
            profile.longitude = data['longitude']
            profile.last_location_updated_at = timezone.now()

        if 'is_location_sharing_enabled' in data:
            profile.is_location_sharing_enabled = data['is_location_sharing_enabled']
            if profile.is_location_sharing_enabled and not is_coord_update and profile.latitude:
                profile.last_location_updated_at = timezone.now()

        profile.save()

        return Response({
            "message": "Worker location updated successfully.",
            "latitude": float(profile.latitude) if profile.latitude else None,
            "longitude": float(profile.longitude) if profile.longitude else None,
            "last_location_updated_at": profile.last_location_updated_at.isoformat() if profile.last_location_updated_at else None,
            "is_location_sharing_enabled": profile.is_location_sharing_enabled,
            "is_location_fresh": profile.is_location_fresh
        }, status=status.HTTP_200_OK)

    def get(self, request):
        profile = getattr(request.user, 'worker_profile', None)
        if not profile:
            return Response({"error": "Worker profile not found."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "latitude": float(profile.latitude) if profile.latitude else None,
            "longitude": float(profile.longitude) if profile.longitude else None,
            "last_location_updated_at": profile.last_location_updated_at.isoformat() if profile.last_location_updated_at else None,
            "is_location_sharing_enabled": profile.is_location_sharing_enabled,
            "is_location_fresh": profile.is_location_fresh
        }, status=status.HTTP_200_OK)

