from datetime import timedelta
from decimal import Decimal
from typing import List, Tuple
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import WorkerProfile, WorkerApprovalStatus, Address
from apps.services.models import Service
from apps.bookings.models import Booking, BookingStatus, WorkerOffer, OfferStatus
from apps.notifications.models import NotificationType, AuditEventType
from apps.notifications.services import create_notification, record_audit_event
from .location import (
    haversine_distance_km,
    get_bounding_box,
    is_within_coimbatore_bounds,
)


class DispatchError(Exception):
    """Base exception for dispatch and booking operations."""
    pass


class ConflictError(DispatchError):
    """Raised when an operation conflicts with current state (e.g. concurrent win)."""
    pass


class OfferExpiredError(DispatchError):
    """Raised when a worker attempts to accept an offer after 60s expiration."""
    pass


class BookingStateError(DispatchError):
    """Raised when a booking is not in a valid state for the requested transition."""
    pass


def find_eligible_workers(
    service: Service,
    customer_lat: float,
    customer_lon: float,
    search_radius_km: float = 5.0
) -> List[Tuple[WorkerProfile, float]]:
    """
    Finds approved, active, available workers offering the requested active service
    within the specified search radius in Coimbatore.
    """
    if not (service.is_active and service.category.is_active):
        return []

    # Prefilter using latitude/longitude bounding box and location freshness
    min_lat, max_lat, min_lon, max_lon = get_bounding_box(customer_lat, customer_lon, search_radius_km)
    from django.conf import settings
    freshness_minutes = getattr(settings, 'WORKER_LOCATION_FRESHNESS_MINUTES', 60)
    cutoff = timezone.now() - timedelta(minutes=freshness_minutes)

    candidates = WorkerProfile.objects.select_related('user').filter(
        approval_status=WorkerApprovalStatus.APPROVED,
        is_active=True,
        is_available=True,
        is_location_sharing_enabled=True,
        user__is_active=True,
        latitude__isnull=False,
        longitude__isnull=False,
        last_location_updated_at__gte=cutoff,
        latitude__gte=min_lat,
        latitude__lte=max_lat,
        longitude__gte=min_lon,
        longitude__lte=max_lon,
        worker_services__service=service,
        worker_services__is_active=True
    ).distinct()

    eligible: List[Tuple[WorkerProfile, float]] = []
    tolerance_km = 0.001  # 1 meter tolerance for boundary float precision

    for worker in candidates:
        w_lat = float(worker.latitude)
        w_lon = float(worker.longitude)
        dist = haversine_distance_km(customer_lat, customer_lon, w_lat, w_lon)
        
        # Must be within search radius and worker's configured service radius
        max_allowed = min(search_radius_km, float(worker.service_radius_km))
        if dist <= (max_allowed + tolerance_km):
            eligible.append((worker, round(dist, 3)))

    # Sort candidates by distance (closest first)
    eligible.sort(key=lambda x: x[1])
    return eligible


def create_booking_and_dispatch(
    customer,
    service: Service,
    address: Address,
    problem_description: str,
    search_radius_km: float = 5.0
) -> Tuple[Booking, int]:
    """
    Validates request, creates booking with immutable location snapshot,
    and broadcasts offers to all eligible workers with a 60-second deadline.
    """
    if not (service.is_active and service.category.is_active):
        raise ValueError("Cannot book an inactive service or a service in an inactive category.")

    if address.user != customer:
        raise PermissionError("The selected address does not belong to the authenticated customer.")

    if not is_within_coimbatore_bounds(address.latitude, address.longitude):
        raise ValueError("Service address coordinates are outside the Coimbatore service region.")

    customer_lat = float(address.latitude)
    customer_lon = float(address.longitude)

    with transaction.atomic():
        booking = Booking.objects.create(
            customer=customer,
            service=service,
            address=address,
            service_address_title=address.title,
            service_address_line=f"{address.address_line1} {address.address_line2}".strip(),
            service_landmark=address.landmark,
            service_city=address.city,
            service_pincode=address.pincode,
            service_latitude=address.latitude,
            service_longitude=address.longitude,
            problem_description=problem_description,
            status=BookingStatus.REQUESTED,
            dispatch_round=1
        )

        record_audit_event(
            event_type=AuditEventType.BOOKING_CREATED,
            actor=customer,
            related_booking=booking,
            metadata={
                'service_id': service.id,
                'service_name': service.name,
                'search_radius_km': search_radius_km
            }
        )

        eligible_workers = find_eligible_workers(
            service=service,
            customer_lat=customer_lat,
            customer_lon=customer_lon,
            search_radius_km=search_radius_km
        )

        if not eligible_workers:
            booking.status = BookingStatus.EXPIRED
            booking.save(update_fields=['status', 'updated_at'])
            record_audit_event(
                event_type=AuditEventType.OFFERS_EXPIRED,
                actor=None,
                related_booking=booking,
                outcome='NO_WORKERS',
                metadata={'reason': 'No eligible workers found in search radius'}
            )
            create_notification(
                recipient=customer,
                notification_type=NotificationType.NO_WORKERS,
                title="No Service Professional Available",
                message=f"No professionals are currently available for {service.name} in your location. You can retry shortly.",
                related_booking=booking,
                idempotency_key=f"no_workers_{booking.id}_{booking.dispatch_round}"
            )
            return booking, 0

        # Mark booking as actively searching
        booking.status = BookingStatus.SEARCHING
        booking.save(update_fields=['status', 'updated_at'])

        # Create worker offers with strict 60s timeout
        now = timezone.now()
        expires_at = now + timedelta(seconds=60)
        
        offers = [
            WorkerOffer(
                booking=booking,
                worker=worker,
                dispatch_round=1,
                status=OfferStatus.PENDING,
                expires_at=expires_at
            )
            for worker, _ in eligible_workers
        ]
        WorkerOffer.objects.bulk_create(offers)

        record_audit_event(
            event_type=AuditEventType.OFFERS_DISPATCHED,
            actor=None,
            related_booking=booking,
            metadata={
                'dispatch_round': 1,
                'worker_count': len(eligible_workers)
            }
        )
        for worker, _ in eligible_workers:
            create_notification(
                recipient=worker.user,
                notification_type=NotificationType.NEW_OFFER,
                title="New Service Request Offer",
                message=f"You have a new offer for {service.name} within your service area. Accept within 60 seconds.",
                related_booking=booking,
                idempotency_key=f"offer_{booking.id}_{worker.id}_{booking.dispatch_round}"
            )

    return booking, len(eligible_workers)


def accept_worker_offer(offer_id: int, worker_profile: WorkerProfile) -> Booking:
    """
    Atomically processes worker acceptance using select_for_update() row locking.
    The first valid acceptance committed by the database wins the assignment.
    """
    if not worker_profile.is_eligible_for_dispatch:
        raise PermissionError("Worker is not approved, active, or eligible for dispatch.")

    now = timezone.now()

    with transaction.atomic():
        try:
            offer_obj = WorkerOffer.objects.get(
                id=offer_id,
                worker=worker_profile
            )
        except WorkerOffer.DoesNotExist:
            raise PermissionError("Offer not found or does not belong to this worker.")

        # Consistent lock hierarchy: lock parent booking first to serialize competing worker acceptances
        booking = Booking.objects.select_for_update().get(id=offer_obj.booking_id)
        offer = WorkerOffer.objects.select_for_update().get(id=offer_obj.id)

        # 1. Check if offer deadline has passed
        if now > offer.expires_at:
            if offer.status == OfferStatus.PENDING:
                offer.status = OfferStatus.EXPIRED
                offer.responded_at = now
                offer.save(update_fields=['status', 'responded_at'])
            raise OfferExpiredError("This offer has expired (60-second response window exceeded).")

        # 2. Check offer status
        if offer.status != OfferStatus.PENDING:
            raise ConflictError(f"Offer is no longer pending (current status: {offer.status}).")

        # 3. Check booking status
        if booking.status == BookingStatus.CANCELLED:
            offer.status = OfferStatus.CANCELLED
            offer.save(update_fields=['status'])
            raise BookingStateError("This booking was cancelled by the customer.")

        if booking.status in [BookingStatus.COMPLETED, BookingStatus.EXPIRED]:
            raise BookingStateError(f"Booking is closed (current status: {booking.status}).")

        if booking.assigned_worker is not None:
            offer.status = OfferStatus.MISSED
            offer.responded_at = now
            offer.save(update_fields=['status', 'responded_at'])
            raise ConflictError("Another worker has already accepted this booking.")

        if booking.status not in [BookingStatus.SEARCHING, BookingStatus.REQUESTED]:
            raise BookingStateError(f"Booking is not open for acceptance (status: {booking.status}).")

        # 4. Winning assignment commit
        booking.assigned_worker = worker_profile
        booking.status = BookingStatus.ASSIGNED
        booking.assigned_at = now
        booking.save(update_fields=['assigned_worker', 'status', 'assigned_at', 'updated_at'])

        offer.status = OfferStatus.ACCEPTED
        offer.responded_at = now
        offer.save(update_fields=['status', 'responded_at'])

        # 5. Invalidate competing pending offers
        WorkerOffer.objects.filter(
            booking=booking,
            status=OfferStatus.PENDING
        ).exclude(id=offer.id).update(
            status=OfferStatus.MISSED,
            responded_at=now
        )

        record_audit_event(
            event_type=AuditEventType.WORKER_ACCEPTED,
            actor=worker_profile.user,
            related_booking=booking,
            metadata={
                'worker_id': worker_profile.id,
                'dispatch_round': booking.dispatch_round
            }
        )
        # Notify winning worker
        create_notification(
            recipient=worker_profile.user,
            notification_type=NotificationType.OFFER_ACCEPTED,
            title="Booking Assignment Confirmed",
            message=f"You won the assignment for booking #{str(booking.id)[:8]}. Please review and prepare a quotation.",
            related_booking=booking,
            idempotency_key=f"offer_accepted_{booking.id}_{worker_profile.id}"
        )
        # Notify customer
        create_notification(
            recipient=booking.customer,
            notification_type=NotificationType.WORKER_ASSIGNED,
            title="Service Professional Assigned",
            message=f"A service professional has accepted your booking request for {booking.service.name}.",
            related_booking=booking,
            idempotency_key=f"worker_assigned_{booking.id}_{worker_profile.id}"
        )

    return booking


def reject_worker_offer(offer_id: int, worker_profile: WorkerProfile, reason: str = '') -> WorkerOffer:
    """Records worker offer rejection and updates booking state if all offers are exhausted."""
    now = timezone.now()
    with transaction.atomic():
        try:
            offer = WorkerOffer.objects.select_for_update().get(id=offer_id, worker=worker_profile)
        except WorkerOffer.DoesNotExist:
            raise PermissionError("Offer not found or does not belong to this worker.")

        if offer.status == OfferStatus.PENDING:
            offer.status = OfferStatus.REJECTED
            offer.rejection_reason = reason
            offer.responded_at = now
            offer.save(update_fields=['status', 'rejection_reason', 'responded_at'])

            record_audit_event(
                event_type=AuditEventType.WORKER_REJECTED,
                actor=worker_profile.user,
                related_booking=offer.booking,
                metadata={'worker_id': worker_profile.id, 'reason': reason}
            )

            # Check if all offers in this round for the booking are resolved
            booking = Booking.objects.select_for_update().get(id=offer.booking_id)
            if booking.status == BookingStatus.SEARCHING:
                pending_remaining = WorkerOffer.objects.filter(
                    booking=booking,
                    dispatch_round=booking.dispatch_round,
                    status=OfferStatus.PENDING
                ).exists()
                if not pending_remaining:
                    booking.status = BookingStatus.EXPIRED
                    booking.save(update_fields=['status', 'updated_at'])
                    record_audit_event(
                        event_type=AuditEventType.OFFERS_EXPIRED,
                        actor=None,
                        related_booking=booking,
                        metadata={'dispatch_round': booking.dispatch_round}
                    )
                    create_notification(
                        recipient=booking.customer,
                        notification_type=NotificationType.BOOKING_EXPIRED,
                        title="Booking Search Expired",
                        message=f"Your booking request for {booking.service.name} expired without worker acceptance. You may retry.",
                        related_booking=booking,
                        idempotency_key=f"booking_expired_{booking.id}_{booking.dispatch_round}"
                    )

    return offer


def expire_stale_offers() -> int:
    """Sweeps overdue pending offers and updates booking status if search round expired."""
    now = timezone.now()
    with transaction.atomic():
        stale_offers = WorkerOffer.objects.select_for_update().filter(
            status=OfferStatus.PENDING,
            expires_at__lt=now
        )
        count = stale_offers.count()
        if count > 0:
            booking_ids = list(set(stale_offers.values_list('booking_id', flat=True)))
            stale_offers.update(status=OfferStatus.EXPIRED, responded_at=now)

            # Check affected bookings
            for b_id in booking_ids:
                booking = Booking.objects.select_for_update().get(id=b_id)
                if booking.status == BookingStatus.SEARCHING:
                    has_pending = WorkerOffer.objects.filter(
                        booking=booking,
                        dispatch_round=booking.dispatch_round,
                        status=OfferStatus.PENDING
                    ).exists()
                    if not has_pending and booking.assigned_worker is None:
                        booking.status = BookingStatus.EXPIRED
                        booking.save(update_fields=['status', 'updated_at'])
                        record_audit_event(
                            event_type=AuditEventType.OFFERS_EXPIRED,
                            actor=None,
                            related_booking=booking,
                            metadata={'dispatch_round': booking.dispatch_round, 'swept_stale_count': count}
                        )
                        create_notification(
                            recipient=booking.customer,
                            notification_type=NotificationType.BOOKING_EXPIRED,
                            title="Booking Search Expired",
                            message=f"Your booking request for {booking.service.name} expired. You can retry dispatch at any time.",
                            related_booking=booking,
                            idempotency_key=f"booking_expired_{booking.id}_{booking.dispatch_round}"
                        )
    return count


def retry_booking_dispatch(booking: Booking, customer, search_radius_km: float = 5.0) -> Tuple[Booking, int]:
    """Retries dispatch for an expired booking by launching a new dispatch round."""
    if booking.customer != customer:
        raise PermissionError("You can only retry your own bookings.")

    with transaction.atomic():
        booking = Booking.objects.select_for_update().get(id=booking.id)
        
        # Only expired or searching-with-no-pending bookings can be retried
        if booking.status not in [BookingStatus.EXPIRED, BookingStatus.SEARCHING]:
            raise BookingStateError(f"Cannot retry booking in '{booking.status}' status.")
        if booking.assigned_worker is not None:
            raise ConflictError("Booking already has an assigned worker.")

        customer_lat = float(booking.service_latitude)
        customer_lon = float(booking.service_longitude)

        eligible_workers = find_eligible_workers(
            service=booking.service,
            customer_lat=customer_lat,
            customer_lon=customer_lon,
            search_radius_km=search_radius_km
        )

        booking.dispatch_round += 1

        record_audit_event(
            event_type=AuditEventType.BOOKING_RETRIED,
            actor=customer,
            related_booking=booking,
            metadata={
                'dispatch_round': booking.dispatch_round,
                'worker_count': len(eligible_workers)
            }
        )

        if not eligible_workers:
            booking.status = BookingStatus.EXPIRED
            booking.save(update_fields=['dispatch_round', 'status', 'updated_at'])
            create_notification(
                recipient=customer,
                notification_type=NotificationType.NO_WORKERS,
                title="No Service Professional Available",
                message=f"No professionals are currently available for {booking.service.name} in your location.",
                related_booking=booking,
                idempotency_key=f"no_workers_{booking.id}_{booking.dispatch_round}"
            )
            return booking, 0

        booking.status = BookingStatus.SEARCHING
        booking.save(update_fields=['dispatch_round', 'status', 'updated_at'])

        now = timezone.now()
        expires_at = now + timedelta(seconds=60)

        offers = [
            WorkerOffer(
                booking=booking,
                worker=worker,
                dispatch_round=booking.dispatch_round,
                status=OfferStatus.PENDING,
                expires_at=expires_at
            )
            for worker, _ in eligible_workers
        ]
        WorkerOffer.objects.bulk_create(offers)

        record_audit_event(
            event_type=AuditEventType.OFFERS_DISPATCHED,
            actor=None,
            related_booking=booking,
            metadata={
                'dispatch_round': booking.dispatch_round,
                'worker_count': len(eligible_workers)
            }
        )
        for worker, _ in eligible_workers:
            create_notification(
                recipient=worker.user,
                notification_type=NotificationType.NEW_OFFER,
                title="New Service Request Offer",
                message=f"You have a new offer for {booking.service.name} within your service area. Accept within 60 seconds.",
                related_booking=booking,
                idempotency_key=f"offer_{booking.id}_{worker.id}_{booking.dispatch_round}"
            )

    return booking, len(eligible_workers)
