from django.db import transaction
from django.utils import timezone
from apps.bookings.models import Booking, BookingStatus, WorkerOffer, OfferStatus
from .dispatch import BookingStateError

def cancel_booking_by_customer(booking_id, customer, reason: str = '') -> Booking:
    """
    Cancels a booking requested by a customer prior to worker acceptance.
    Invalidates all outstanding offers immediately.
    """
    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.customer != customer:
            raise PermissionError("You can only cancel your own bookings.")

        # Customer cancellation permitted before worker acceptance
        if booking.status not in [BookingStatus.REQUESTED, BookingStatus.SEARCHING]:
            raise BookingStateError(
                f"Booking cannot be cancelled in '{booking.status}' status. "
                "Cancellations are only permitted prior to worker assignment."
            )

        now = timezone.now()
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_by = customer
        booking.cancelled_at = now
        booking.cancellation_reason = reason
        booking.save(update_fields=['status', 'cancelled_by', 'cancelled_at', 'cancellation_reason', 'updated_at'])

        # Invalidate any pending broadcast offers
        WorkerOffer.objects.filter(
            booking=booking,
            status=OfferStatus.PENDING
        ).update(status=OfferStatus.CANCELLED)

        from apps.notifications.models import NotificationType, AuditEventType
        from apps.notifications.services import create_notification, record_audit_event

        record_audit_event(
            event_type=AuditEventType.BOOKING_CANCELLED,
            actor=customer,
            related_booking=booking,
            metadata={'cancellation_reason': reason}
        )
        create_notification(
            recipient=customer,
            notification_type=NotificationType.BOOKING_CANCELLED,
            title="Booking Cancelled",
            message=f"Your booking #{str(booking.id)[:8]} has been cancelled.",
            related_booking=booking,
            idempotency_key=f"booking_cancelled_cust_{booking.id}"
        )
        if booking.assigned_worker:
            create_notification(
                recipient=booking.assigned_worker.user,
                notification_type=NotificationType.BOOKING_CANCELLED,
                title="Booking Cancelled by Customer",
                message=f"Booking #{str(booking.id)[:8]} was cancelled by the customer.",
                related_booking=booking,
                idempotency_key=f"booking_cancelled_worker_{booking.id}"
            )

    return booking


def worker_confirm_heading(booking_id, worker_profile) -> Booking:
    """
    Assigned worker explicitly confirms they are en route to the customer location.
    Transitions travel_status to HEADING_TO_JOB.
    """
    from apps.bookings.models import WorkerTravelStatus
    from apps.notifications.models import NotificationType, AuditEventType
    from apps.notifications.services import create_notification, record_audit_event

    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.assigned_worker != worker_profile:
            raise PermissionError("Only the assigned service professional can confirm travel.")

        if booking.status not in [BookingStatus.ASSIGNED, BookingStatus.QUOTE_PENDING, BookingStatus.QUOTE_ACCEPTED]:
            raise BookingStateError(f"Cannot update travel status while booking is in '{booking.status}' state.")

        if booking.travel_status in [WorkerTravelStatus.HEADING_TO_JOB, WorkerTravelStatus.ARRIVED]:
            raise BookingStateError(f"Travel status is already '{booking.travel_status}'.")

        now = timezone.now()
        booking.travel_status = WorkerTravelStatus.HEADING_TO_JOB
        booking.worker_heading_at = now
        booking.save(update_fields=['travel_status', 'worker_heading_at', 'updated_at'])

        record_audit_event(
            event_type=AuditEventType.WORKER_HEADING,
            actor=worker_profile.user,
            related_booking=booking,
            metadata={'worker_id': worker_profile.id}
        )
        create_notification(
            recipient=booking.customer,
            notification_type=NotificationType.WORKER_HEADING,
            title="Professional On The Way",
            message=f"Your service professional {worker_profile.user.get_full_name() or worker_profile.user.username} is heading to your address.",
            related_booking=booking,
            idempotency_key=f"worker_heading_{booking.id}_{worker_profile.id}"
        )

    return booking


def worker_confirm_arrival(booking_id, worker_profile) -> Booking:
    """
    Assigned worker explicitly confirms arrival at the service address.
    Transitions travel_status to ARRIVED.
    Note: Does not bypass quotation acceptance required for work start.
    """
    from apps.bookings.models import WorkerTravelStatus
    from apps.notifications.models import NotificationType, AuditEventType
    from apps.notifications.services import create_notification, record_audit_event

    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.assigned_worker != worker_profile:
            raise PermissionError("Only the assigned service professional can confirm arrival.")

        if booking.status not in [BookingStatus.ASSIGNED, BookingStatus.QUOTE_PENDING, BookingStatus.QUOTE_ACCEPTED]:
            raise BookingStateError(f"Cannot confirm arrival while booking is in '{booking.status}' state.")

        if booking.travel_status == WorkerTravelStatus.ARRIVED:
            raise BookingStateError("Arrival has already been confirmed.")

        now = timezone.now()
        booking.travel_status = WorkerTravelStatus.ARRIVED
        booking.worker_arrived_at = now
        booking.save(update_fields=['travel_status', 'worker_arrived_at', 'updated_at'])

        record_audit_event(
            event_type=AuditEventType.WORKER_ARRIVED,
            actor=worker_profile.user,
            related_booking=booking,
            metadata={'worker_id': worker_profile.id}
        )
        create_notification(
            recipient=booking.customer,
            notification_type=NotificationType.WORKER_ARRIVED,
            title="Professional Has Arrived",
            message=f"Your service professional has arrived at your location.",
            related_booking=booking,
            idempotency_key=f"worker_arrived_{booking.id}_{worker_profile.id}"
        )

    return booking


def worker_report_delay(booking_id, worker_profile, reason: str, estimated_minutes: int = None) -> Booking:
    """
    Assigned worker reports transit delay with an explanation and optional ETA.
    """
    from apps.bookings.models import WorkerTravelStatus
    from apps.notifications.models import NotificationType, AuditEventType
    from apps.notifications.services import create_notification, record_audit_event

    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.assigned_worker != worker_profile:
            raise PermissionError("Only the assigned service professional can report a transit delay.")

        if booking.status not in [BookingStatus.ASSIGNED, BookingStatus.QUOTE_PENDING, BookingStatus.QUOTE_ACCEPTED]:
            raise BookingStateError(f"Cannot report delay while booking is in '{booking.status}' state.")

        booking.travel_status = WorkerTravelStatus.DELAYED
        booking.delay_reason = reason
        if estimated_minutes:
            booking.estimated_arrival_minutes = max(1, int(estimated_minutes))
        booking.save(update_fields=['travel_status', 'delay_reason', 'estimated_arrival_minutes', 'updated_at'])

        record_audit_event(
            event_type=AuditEventType.WORKER_DELAYED,
            actor=worker_profile.user,
            related_booking=booking,
            metadata={
                'worker_id': worker_profile.id,
                'delay_reason': reason,
                'estimated_minutes': estimated_minutes
            }
        )
        eta_msg = f" (estimated {estimated_minutes} mins delay)" if estimated_minutes else ""
        create_notification(
            recipient=booking.customer,
            notification_type=NotificationType.WORKER_DELAYED,
            title="Professional Reported Transit Delay",
            message=f"Your service professional reported a delay{eta_msg}: {reason}",
            related_booking=booking,
            idempotency_key=f"worker_delayed_{booking.id}_{timezone.now().strftime('%Y%m%d%H%M')}"
        )

    return booking


def report_worker_no_show(booking_id, customer, reason: str):
    """
    Customer files a formal incident report when the assigned worker fails to appear.
    Creates a NoShowReport incident record and sends notifications.
    """
    from apps.bookings.models import NoShowReport, IncidentStatus
    from apps.notifications.models import NotificationType, AuditEventType
    from apps.notifications.services import create_notification, record_audit_event

    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.customer != customer:
            raise PermissionError("You can only report no-show incidents for your own bookings.")

        if not booking.assigned_worker:
            raise BookingStateError("Cannot report a no-show on an unassigned booking.")

        if booking.status in [BookingStatus.COMPLETED, BookingStatus.CANCELLED]:
            raise BookingStateError(f"Cannot report a no-show on a {booking.status.lower()} booking.")

        # Check for existing open report
        existing = NoShowReport.objects.filter(
            booking=booking,
            status__in=[IncidentStatus.OPEN, IncidentStatus.UNDER_REVIEW]
        ).first()
        if existing:
            return existing

        report = NoShowReport.objects.create(
            booking=booking,
            reported_by=customer,
            assigned_worker=booking.assigned_worker,
            status=IncidentStatus.OPEN,
            reason=reason
        )

        record_audit_event(
            event_type=AuditEventType.NO_SHOW_REPORTED,
            actor=customer,
            related_booking=booking,
            metadata={
                'report_id': str(report.id),
                'worker_id': booking.assigned_worker.id,
                'reason': reason
            }
        )

        # Notify assigned worker
        create_notification(
            recipient=booking.assigned_worker.user,
            notification_type=NotificationType.NO_SHOW_REPORTED,
            title="No-Show Incident Reported",
            message=f"The customer reported a no-show for booking #{str(booking.id)[:8]}. Reason: {reason}",
            related_booking=booking,
            idempotency_key=f"no_show_worker_{report.id}"
        )

    return report


def release_assignment_and_reassign(booking_id, actor, resolution_notes: str = '', search_radius_km: float = 5.0):
    """
    Atomically releases the existing assigned worker, closes incident records,
    and initiates a fresh broadcast round for other eligible workers.
    Ensures zero window where two workers are concurrently assigned.
    """
    from apps.bookings.models import WorkerTravelStatus, NoShowReport, IncidentStatus
    from apps.notifications.models import NotificationType, AuditEventType
    from apps.notifications.services import create_notification, record_audit_event
    from .dispatch import find_eligible_workers

    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        # Admin or authorized resolution
        is_admin = bool(actor.role == 'ADMIN' or actor.is_superuser or actor.is_staff)
        is_owner = (booking.customer == actor)
        if not (is_admin or is_owner):
            raise PermissionError("You do not have permission to release this assignment.")

        if not booking.assigned_worker:
            raise BookingStateError("Booking has no assigned worker to release.")

        if booking.status in [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.IN_PROGRESS]:
            raise BookingStateError(f"Cannot reassign a booking in '{booking.status}' status.")

        previous_worker = booking.assigned_worker
        now = timezone.now()

        # Invalidate previous worker's offers
        WorkerOffer.objects.filter(
            booking=booking,
            worker=previous_worker
        ).update(status=OfferStatus.CANCELLED)

        # Resolve open no-show reports
        NoShowReport.objects.filter(
            booking=booking,
            status__in=[IncidentStatus.OPEN, IncidentStatus.UNDER_REVIEW]
        ).update(
            status=IncidentStatus.RESOLVED,
            resolution_notes=resolution_notes or f"Assignment released by {actor.username}",
            resolved_at=now,
            resolved_by=actor
        )

        # Reset assignment and travel state on booking
        booking.assigned_worker = None
        booking.assigned_at = None
        booking.travel_status = WorkerTravelStatus.NOT_STARTED
        booking.worker_heading_at = None
        booking.worker_arrived_at = None
        booking.delay_reason = ''
        booking.estimated_arrival_minutes = None
        booking.dispatch_round += 1

        # Search for fresh eligible workers (excluding the released worker)
        customer_lat = float(booking.service_latitude)
        customer_lon = float(booking.service_longitude)
        eligible_workers = find_eligible_workers(
            service=booking.service,
            customer_lat=customer_lat,
            customer_lon=customer_lon,
            search_radius_km=search_radius_km
        )
        eligible_candidates = [w for w, _ in eligible_workers if w.id != previous_worker.id]

        if not eligible_candidates:
            booking.status = BookingStatus.EXPIRED
            booking.save(update_fields=[
                'assigned_worker', 'assigned_at', 'travel_status',
                'worker_heading_at', 'worker_arrived_at', 'delay_reason',
                'estimated_arrival_minutes', 'dispatch_round', 'status', 'updated_at'
            ])
            record_audit_event(
                event_type=AuditEventType.BOOKING_REASSIGNED,
                actor=actor,
                related_booking=booking,
                metadata={
                    'previous_worker_id': previous_worker.id,
                    'dispatched_count': 0,
                    'outcome': 'EXPIRED_NO_ALTERNATIVES'
                }
            )
            create_notification(
                recipient=booking.customer,
                notification_type=NotificationType.NO_WORKERS,
                title="Reassignment: No Alternative Professionals",
                message=f"Previous professional was released, but no alternative professionals are currently nearby in Coimbatore. You may retry search shortly.",
                related_booking=booking,
                idempotency_key=f"reassign_no_workers_{booking.id}_{booking.dispatch_round}"
            )
        else:
            booking.status = BookingStatus.SEARCHING
            booking.save(update_fields=[
                'assigned_worker', 'assigned_at', 'travel_status',
                'worker_heading_at', 'worker_arrived_at', 'delay_reason',
                'estimated_arrival_minutes', 'dispatch_round', 'status', 'updated_at'
            ])

            from datetime import timedelta
            expires_at = now + timedelta(seconds=60)
            offers = [
                WorkerOffer(
                    booking=booking,
                    worker=worker,
                    dispatch_round=booking.dispatch_round,
                    expires_at=expires_at,
                    status=OfferStatus.PENDING
                )
                for worker in eligible_candidates
            ]
            WorkerOffer.objects.bulk_create(offers)

            record_audit_event(
                event_type=AuditEventType.BOOKING_REASSIGNED,
                actor=actor,
                related_booking=booking,
                metadata={
                    'previous_worker_id': previous_worker.id,
                    'dispatched_count': len(eligible_candidates),
                    'round': booking.dispatch_round
                }
            )

            for worker in eligible_candidates:
                create_notification(
                    recipient=worker.user,
                    notification_type=NotificationType.NEW_OFFER,
                    title="New Service Request Offer",
                    message=f"You have a new offer for {booking.service.name}. Respond within 60 seconds.",
                    related_booking=booking,
                    idempotency_key=f"offer_{booking.id}_{worker.id}_{booking.dispatch_round}"
                )

            create_notification(
                recipient=booking.customer,
                notification_type=NotificationType.BOOKING_REASSIGNED,
                title="Booking Reassigned",
                message=f"Previous professional was released. Broadcasted to {len(eligible_candidates)} nearby professionals.",
                related_booking=booking,
                idempotency_key=f"reassign_cust_{booking.id}_{booking.dispatch_round}"
            )

        # Notify previous worker of release
        create_notification(
            recipient=previous_worker.user,
            notification_type=NotificationType.BOOKING_CANCELLED,
            title="Assignment Released",
            message=f"Your assignment for booking #{str(booking.id)[:8]} has been released.",
            related_booking=booking,
            idempotency_key=f"released_worker_{booking.id}_{previous_worker.id}"
        )

    return booking, len(eligible_candidates) if 'eligible_candidates' in locals() else 0
