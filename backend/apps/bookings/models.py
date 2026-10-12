import uuid
from django.db import models
from django.conf import settings
from decimal import Decimal

class BookingStatus(models.TextChoices):
    REQUESTED = 'REQUESTED', 'Requested'
    SEARCHING = 'SEARCHING', 'Searching for Workers'
    ASSIGNED = 'ASSIGNED', 'Worker Assigned'
    QUOTE_PENDING = 'QUOTE_PENDING', 'Quotation Pending'
    QUOTE_ACCEPTED = 'QUOTE_ACCEPTED', 'Quotation Accepted'
    IN_PROGRESS = 'IN_PROGRESS', 'Work In Progress'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'
    EXPIRED = 'EXPIRED', 'Expired / No Worker Available'


class WorkerTravelStatus(models.TextChoices):
    NOT_STARTED = 'NOT_STARTED', 'Not Started'
    HEADING_TO_JOB = 'HEADING_TO_JOB', 'Heading to Job'
    ARRIVED = 'ARRIVED', 'Arrived at Location'
    DELAYED = 'DELAYED', 'Delayed'


class IncidentStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    RESOLVED = 'RESOLVED', 'Resolved'
    DISMISSED = 'DISMISSED', 'Dismissed'


class OfferStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Worker Response'
    ACCEPTED = 'ACCEPTED', 'Accepted (Assignment Won)'
    REJECTED = 'REJECTED', 'Rejected by Worker'
    EXPIRED = 'EXPIRED', 'Expired (Timeout 60s)'
    MISSED = 'MISSED', 'Missed (Won by Another Worker)'
    CANCELLED = 'CANCELLED', 'Cancelled (Booking Cancelled)'


class Booking(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text='Unique UUID for booking tracking'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='customer_bookings',
        help_text='Customer who requested the service'
    )
    service = models.ForeignKey(
        'services.Service',
        on_delete=models.PROTECT,
        related_name='bookings',
        help_text='Requested service'
    )
    address = models.ForeignKey(
        'accounts.Address',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='bookings',
        help_text='Original saved customer address'
    )
    # Immutable historical service location snapshot
    service_address_title = models.CharField(max_length=60, default='Service Location')
    service_address_line = models.CharField(max_length=255)
    service_landmark = models.CharField(max_length=150, blank=True, default='')
    service_city = models.CharField(max_length=100, default='Coimbatore')
    service_pincode = models.CharField(max_length=10)
    service_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    service_longitude = models.DecimalField(max_digits=9, decimal_places=6)

    problem_description = models.TextField(
        help_text='Customer explanation of the fault or maintenance required'
    )
    status = models.CharField(
        max_length=30,
        choices=BookingStatus.choices,
        default=BookingStatus.REQUESTED,
        db_index=True
    )
    assigned_worker = models.ForeignKey(
        'accounts.WorkerProfile',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_bookings',
        help_text='Winning service professional assigned to this job'
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    travel_status = models.CharField(
        max_length=25,
        choices=WorkerTravelStatus.choices,
        default=WorkerTravelStatus.NOT_STARTED,
        db_index=True,
        help_text='Worker transit status for the assigned job'
    )
    worker_heading_at = models.DateTimeField(null=True, blank=True)
    worker_arrived_at = models.DateTimeField(null=True, blank=True)
    estimated_arrival_minutes = models.PositiveIntegerField(null=True, blank=True)
    delay_reason = models.TextField(blank=True, default='')
    dispatch_round = models.PositiveIntegerField(
        default=1,
        help_text='Current broadcast round; incremented on customer retry'
    )
    cancellation_reason = models.TextField(blank=True, default='')
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='cancelled_bookings'
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['assigned_worker', 'status']),
            models.Index(fields=['assigned_worker', 'travel_status']),
        ]

    def __str__(self):
        return f"Booking {self.id} [{self.service.name}] - {self.status}"


class WorkerOffer(models.Model):
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='offers',
        help_text='Related booking broadcast'
    )
    worker = models.ForeignKey(
        'accounts.WorkerProfile',
        on_delete=models.CASCADE,
        related_name='offers',
        help_text='Eligible candidate worker receiving the broadcast'
    )
    dispatch_round = models.PositiveIntegerField(
        default=1,
        help_text='Dispatch iteration round'
    )
    status = models.CharField(
        max_length=20,
        choices=OfferStatus.choices,
        default=OfferStatus.PENDING,
        db_index=True
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        db_index=True,
        help_text='Server-side 60s expiration deadline'
    )
    responded_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-sent_at']
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'worker', 'dispatch_round'],
                name='unique_booking_worker_dispatch_round'
            )
        ]
        indexes = [
            models.Index(fields=['worker', 'status']),
            models.Index(fields=['booking', 'status']),
        ]

    def __str__(self):
        return f"Offer {self.id} for Booking {self.booking_id} -> Worker {self.worker_id} [{self.status}]"


class NoShowReport(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text='Unique identifier for the no-show incident report'
    )
    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='no_show_reports',
        help_text='Booking where worker failed to arrive'
    )
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='reported_no_shows',
        help_text='Customer who reported the incident'
    )
    assigned_worker = models.ForeignKey(
        'accounts.WorkerProfile',
        on_delete=models.PROTECT,
        related_name='no_show_incidents',
        help_text='Worker who failed to appear'
    )
    status = models.CharField(
        max_length=20,
        choices=IncidentStatus.choices,
        default=IncidentStatus.OPEN,
        db_index=True
    )
    reason = models.TextField(help_text='Detailed reason for reporting the no-show')
    resolution_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='resolved_no_shows'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking', 'status']),
            models.Index(fields=['assigned_worker', 'status']),
        ]

    def __str__(self):
        return f"NoShowReport {self.id} for Booking {self.booking_id} [{self.status}]"
