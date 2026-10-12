import uuid
from django.db import models
from django.conf import settings

class NotificationType(models.TextChoices):
    NEW_OFFER = 'NEW_OFFER', 'New Job Broadcast Offer'
    WORKER_ASSIGNED = 'WORKER_ASSIGNED', 'Worker Assigned'
    OFFER_ACCEPTED = 'OFFER_ACCEPTED', 'Offer Acceptance Confirmed'
    NO_WORKERS = 'NO_WORKERS', 'No Workers Available'
    BOOKING_CANCELLED = 'BOOKING_CANCELLED', 'Booking Cancelled'
    BOOKING_EXPIRED = 'BOOKING_EXPIRED', 'Booking Expired'
    QUOTATION_SUBMITTED = 'QUOTATION_SUBMITTED', 'Quotation Submitted'
    QUOTATION_REVISED = 'QUOTATION_REVISED', 'Quotation Revised'
    QUOTATION_ACCEPTED = 'QUOTATION_ACCEPTED', 'Quotation Accepted'
    QUOTATION_DECLINED = 'QUOTATION_DECLINED', 'Quotation Declined'
    WORK_STARTED = 'WORK_STARTED', 'Work Started'
    WORK_COMPLETED = 'WORK_COMPLETED', 'Work Completed'
    WORKER_HEADING = 'WORKER_HEADING', 'Worker Heading to Job'
    WORKER_ARRIVED = 'WORKER_ARRIVED', 'Worker Arrived at Location'
    WORKER_DELAYED = 'WORKER_DELAYED', 'Worker Reported Delay'
    NO_SHOW_REPORTED = 'NO_SHOW_REPORTED', 'No-Show Incident Reported'
    BOOKING_REASSIGNED = 'BOOKING_REASSIGNED', 'Booking Reassigned'


class AuditEventType(models.TextChoices):
    BOOKING_CREATED = 'BOOKING_CREATED', 'Booking Created'
    OFFERS_DISPATCHED = 'OFFERS_DISPATCHED', 'Offers Dispatched'
    WORKER_ACCEPTED = 'WORKER_ACCEPTED', 'Worker Accepted Offer'
    WORKER_REJECTED = 'WORKER_REJECTED', 'Worker Rejected Offer'
    OFFERS_EXPIRED = 'OFFERS_EXPIRED', 'Offers Expired'
    BOOKING_CANCELLED = 'BOOKING_CANCELLED', 'Booking Cancelled'
    BOOKING_RETRIED = 'BOOKING_RETRIED', 'Booking Dispatch Retried'
    QUOTATION_SUBMITTED = 'QUOTATION_SUBMITTED', 'Quotation Submitted'
    QUOTATION_REVISED = 'QUOTATION_REVISED', 'Quotation Revised'
    QUOTATION_ACCEPTED = 'QUOTATION_ACCEPTED', 'Quotation Accepted'
    QUOTATION_DECLINED = 'QUOTATION_DECLINED', 'Quotation Declined'
    WORK_STARTED = 'WORK_STARTED', 'Work Started'
    WORK_COMPLETED = 'WORK_COMPLETED', 'Work Completed'
    WORKER_APPROVAL_UPDATED = 'WORKER_APPROVAL_UPDATED', 'Worker Approval Status Updated'
    WORKER_HEADING = 'WORKER_HEADING', 'Worker Heading to Job'
    WORKER_ARRIVED = 'WORKER_ARRIVED', 'Worker Arrived at Location'
    WORKER_DELAYED = 'WORKER_DELAYED', 'Worker Reported Delay'
    NO_SHOW_REPORTED = 'NO_SHOW_REPORTED', 'No-Show Reported'
    NO_SHOW_RESOLVED = 'NO_SHOW_RESOLVED', 'No-Show Resolved'
    BOOKING_REASSIGNED = 'BOOKING_REASSIGNED', 'Booking Reassigned'


class Notification(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text='Unique identifier for this notification'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text='User receiving the in-app notification'
    )
    notification_type = models.CharField(
        max_length=40,
        choices=NotificationType.choices,
        db_index=True
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    related_booking = models.ForeignKey(
        'bookings.Booking',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='notifications',
        help_text='Booking associated with this event'
    )
    is_read = models.BooleanField(
        default=False,
        db_index=True
    )
    read_at = models.DateTimeField(null=True, blank=True)
    idempotency_key = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        unique=True,
        help_text='Stable key to prevent duplicate notifications for retried requests'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['recipient', 'is_read']),
        ]

    def __str__(self):
        return f"Notification {self.id} -> {self.recipient.username} [{self.notification_type}] (Read: {self.is_read})"


class AuditEvent(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    event_type = models.CharField(
        max_length=50,
        choices=AuditEventType.choices,
        db_index=True
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_events',
        help_text='User who initiated the action (null for automated system events)'
    )
    related_booking = models.ForeignKey(
        'bookings.Booking',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_events'
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    outcome = models.CharField(max_length=50, default='SUCCESS')
    metadata = models.JSONField(
        default=dict,
        help_text='Sanitized non-sensitive audit context'
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['event_type', '-timestamp']),
            models.Index(fields=['related_booking', '-timestamp']),
        ]

    def __str__(self):
        actor_name = self.actor.username if self.actor else "SYSTEM"
        return f"Audit {self.id}: {self.event_type} by {actor_name} [{self.outcome}]"
