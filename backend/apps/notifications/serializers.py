from rest_framework import serializers
from apps.notifications.models import Notification, AuditEvent

class NotificationSerializer(serializers.ModelSerializer):
    related_booking_id = serializers.UUIDField(source='related_booking.id', read_only=True, allow_null=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'message',
            'related_booking_id', 'is_read', 'read_at', 'created_at'
        ]
        read_only_fields = fields


class AuditEventSerializer(serializers.ModelSerializer):
    actor_username = serializers.ReadOnlyField(source='actor.username')
    related_booking_id = serializers.UUIDField(source='related_booking.id', read_only=True, allow_null=True)

    class Meta:
        model = AuditEvent
        fields = [
            'id', 'event_type', 'actor_username', 'related_booking_id',
            'outcome', 'metadata', 'timestamp'
        ]
        read_only_fields = fields
