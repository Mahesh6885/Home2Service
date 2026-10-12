from typing import Optional, Dict, Any
from django.db import IntegrityError
from apps.notifications.models import Notification, NotificationType, AuditEvent, AuditEventType

# Sensitive keys that must NEVER be written to audit metadata
SENSITIVE_KEYS = {
    'password', 'password_confirm', 'token', 'access', 'refresh',
    'secret', 'authorization', 'id_document', 'id_number',
    'address_line1', 'address_line2', 'service_address_line'
}

def sanitize_metadata(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Filters dictionary to strictly exclude passwords, tokens, or private details."""
    if not data or not isinstance(data, dict):
        return {}
    sanitized = {}
    for k, v in data.items():
        if k.lower() in SENSITIVE_KEYS:
            continue
        # Convert non-serializable objects (like UUIDs or Decimals) to strings
        if hasattr(v, '__str__') and not isinstance(v, (int, float, bool, str, list, dict, type(None))):
            sanitized[k] = str(v)
        else:
            sanitized[k] = v
    return sanitized


def create_notification(
    recipient,
    notification_type: str,
    title: str,
    message: str,
    related_booking=None,
    idempotency_key: Optional[str] = None
) -> Optional[Notification]:
    """
    Creates an in-app notification.
    If idempotency_key is provided and an existing notification matches, returns it safely.
    """
    if not recipient:
        return None

    if idempotency_key:
        existing = Notification.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing
        try:
            return Notification.objects.create(
                recipient=recipient,
                notification_type=notification_type,
                title=title,
                message=message,
                related_booking=related_booking,
                idempotency_key=idempotency_key
            )
        except IntegrityError:
            return Notification.objects.filter(idempotency_key=idempotency_key).first()

    return Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        title=title,
        message=message,
        related_booking=related_booking
    )


def record_audit_event(
    event_type: str,
    actor=None,
    related_booking=None,
    outcome: str = 'SUCCESS',
    metadata: Optional[Dict[str, Any]] = None
) -> AuditEvent:
    """
    Appends an immutable audit event recording an authoritative business state change.
    """
    clean_meta = sanitize_metadata(metadata)
    return AuditEvent.objects.create(
        event_type=event_type,
        actor=actor,
        related_booking=related_booking,
        outcome=outcome,
        metadata=clean_meta
    )
