from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone

from apps.accounts.permissions import IsAdminUserRole
from apps.notifications.models import Notification, AuditEvent
from apps.notifications.serializers import NotificationSerializer, AuditEventSerializer


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(recipient=self.request.user).select_related('related_booking').order_by('-created_at')
        unread_param = self.request.query_params.get('unread')
        if unread_param and unread_param.lower() in ('true', '1'):
            queryset = queryset.filter(is_read=False)
        return queryset


class NotificationUnreadCountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count}, status=status.HTTP_200_OK)


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at'])

        return Response({
            "message": "Notification marked as read.",
            "notification": NotificationSerializer(notification).data
        }, status=status.HTTP_200_OK)


class NotificationMarkAllReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        count = Notification.objects.filter(
            recipient=request.user,
            is_read=False
        ).update(is_read=True, read_at=now)

        return Response({
            "message": "All notifications marked as read.",
            "updated_count": count
        }, status=status.HTTP_200_OK)


class AdminAuditEventListView(generics.ListAPIView):
    serializer_class = AuditEventSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        queryset = AuditEvent.objects.select_related('actor', 'related_booking').all().order_by('-timestamp')
        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        booking_id = self.request.query_params.get('booking_id')
        if booking_id:
            queryset = queryset.filter(related_booking_id=booking_id)
        return queryset
