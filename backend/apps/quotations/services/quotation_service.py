from decimal import Decimal
from typing import List, Dict, Any, Optional
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import WorkerProfile
from apps.bookings.models import Booking, BookingStatus
from apps.quotations.models import Quotation, QuotationItem, QuotationStatus, ItemType
from apps.notifications.models import NotificationType, AuditEventType
from apps.notifications.services import create_notification, record_audit_event


class QuotationServiceError(Exception):
    """Base exception for quotation workflow errors."""
    pass


class QuotationConflictError(QuotationServiceError):
    """Raised when quotation transitions race or conflict (e.g. revising accepted quote)."""
    pass


class QuotationStateError(QuotationServiceError):
    """Raised when an operation is invalid for current booking or quotation status."""
    pass


def create_or_revise_quotation(
    booking: Booking,
    worker: WorkerProfile,
    work_description: str,
    items_data: Optional[List[Dict[str, Any]]] = None,
    labor_charge: Optional[Decimal] = None,
    materials_charge: Optional[Decimal] = None,
    other_charges: Optional[Decimal] = None,
    notes: str = ''
) -> Quotation:
    """
    Submits a new quotation or a revision for an assigned booking.
    Calculates charges authoritatively on the server.
    Preserves prior quotations as SUPERSEDED for audit history.
    """
    if booking.assigned_worker != worker:
        raise PermissionError("Only the worker assigned to this booking can submit a quotation.")

    if not worker.is_eligible_for_dispatch:
        raise PermissionError("Worker is not approved, active, or eligible to provide quotations.")

    if booking.status in [BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.EXPIRED]:
        raise QuotationStateError(f"Cannot submit quotation for booking in terminal status '{booking.status}'.")

    if booking.status not in [BookingStatus.ASSIGNED, BookingStatus.QUOTE_PENDING]:
        raise QuotationStateError(f"Booking is not open for quotation submission (current status: '{booking.status}').")

    with transaction.atomic():
        # Lock booking to prevent concurrent state changes
        locked_booking = Booking.objects.select_for_update().get(id=booking.id)

        # Check if an accepted quotation already exists
        if Quotation.objects.filter(booking=locked_booking, status=QuotationStatus.ACCEPTED).exists():
            raise QuotationConflictError("Cannot revise a quotation that has already been accepted by the customer.")

        # Determine revision number
        latest_quote = Quotation.objects.filter(booking=locked_booking).order_by('-revision_number').first()
        revision_num = (latest_quote.revision_number + 1) if latest_quote else 1

        # Supersede any previous active pending quotation
        Quotation.objects.filter(
            booking=locked_booking,
            status=QuotationStatus.PENDING
        ).update(status=QuotationStatus.SUPERSEDED)

        # Server-authoritative calculation of amounts
        calc_labor = Decimal('0.00')
        calc_materials = Decimal('0.00')
        calc_other = Decimal('0.00')
        created_items = []

        if items_data and len(items_data) > 0:
            for item_dict in items_data:
                itype = item_dict.get('item_type', ItemType.LABOR)
                desc = item_dict.get('description', '').strip()
                qty = Decimal(str(item_dict.get('quantity', 1)))
                uprice = Decimal(str(item_dict.get('unit_price', 0)))

                if qty <= Decimal('0.00'):
                    raise ValueError("Item quantity must be greater than zero.")
                if uprice < Decimal('0.00'):
                    raise ValueError("Item unit price cannot be negative.")
                if not desc:
                    raise ValueError("Item description is required.")

                line_total = round(qty * uprice, 2)
                if itype == ItemType.LABOR:
                    calc_labor += line_total
                elif itype == ItemType.MATERIAL:
                    calc_materials += line_total
                else:
                    calc_other += line_total

                created_items.append({
                    'item_type': itype,
                    'description': desc,
                    'quantity': qty,
                    'unit_price': uprice,
                    'line_total': line_total
                })
        else:
            calc_labor = round(Decimal(str(labor_charge or '0.00')), 2)
            calc_materials = round(Decimal(str(materials_charge or '0.00')), 2)
            calc_other = round(Decimal(str(other_charges or '0.00')), 2)

        if calc_labor < Decimal('0.00') or calc_materials < Decimal('0.00') or calc_other < Decimal('0.00'):
            raise ValueError("Quotation charges cannot be negative.")

        total_amount = calc_labor + calc_materials + calc_other
        if total_amount <= Decimal('0.00'):
            raise ValueError("Quotation total amount must be greater than zero.")

        quotation = Quotation.objects.create(
            booking=locked_booking,
            worker=worker,
            revision_number=revision_num,
            status=QuotationStatus.PENDING,
            labor_charge=calc_labor,
            materials_charge=calc_materials,
            other_charges=calc_other,
            total_amount=total_amount,
            work_description=work_description,
            notes=notes
        )

        if created_items:
            item_objs = [
                QuotationItem(
                    quotation=quotation,
                    item_type=item['item_type'],
                    description=item['description'],
                    quantity=item['quantity'],
                    unit_price=item['unit_price'],
                    line_total=item['line_total']
                )
                for item in created_items
            ]
            QuotationItem.objects.bulk_create(item_objs)

        # Update booking status to QUOTE_PENDING
        locked_booking.status = BookingStatus.QUOTE_PENDING
        locked_booking.save(update_fields=['status', 'updated_at'])

        if revision_num == 1:
            record_audit_event(
                event_type=AuditEventType.QUOTATION_SUBMITTED,
                actor=worker.user,
                related_booking=locked_booking,
                metadata={
                    'quotation_id': quotation.id,
                    'revision_number': 1,
                    'total_amount': quotation.total_amount
                }
            )
            create_notification(
                recipient=locked_booking.customer,
                notification_type=NotificationType.QUOTATION_SUBMITTED,
                title="Quotation Received",
                message=f"Your service professional submitted a quotation of ₹{quotation.total_amount} for your review.",
                related_booking=locked_booking,
                idempotency_key=f"quote_submitted_{quotation.id}"
            )
        else:
            record_audit_event(
                event_type=AuditEventType.QUOTATION_REVISED,
                actor=worker.user,
                related_booking=locked_booking,
                metadata={
                    'quotation_id': quotation.id,
                    'revision_number': revision_num,
                    'total_amount': quotation.total_amount
                }
            )
            create_notification(
                recipient=locked_booking.customer,
                notification_type=NotificationType.QUOTATION_REVISED,
                title="Revised Quotation Received",
                message=f"Your service professional submitted a revised quotation (Revision {revision_num}) of ₹{quotation.total_amount}.",
                related_booking=locked_booking,
                idempotency_key=f"quote_revised_{quotation.id}"
            )

    return quotation


def accept_quotation(booking_id, quotation_id, customer) -> Quotation:
    """
    Atomically accepts the current pending quotation for a customer booking.
    Transitions booking to QUOTE_ACCEPTED.
    """
    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.customer != customer:
            raise PermissionError("You can only respond to quotations for your own bookings.")

        if booking.status in [BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.EXPIRED]:
            raise QuotationStateError(f"Cannot accept quotation on booking in '{booking.status}' status.")

        try:
            quotation = Quotation.objects.select_for_update().get(id=quotation_id, booking=booking)
        except Quotation.DoesNotExist:
            raise KeyError("Quotation not found for this booking.")

        if quotation.status != QuotationStatus.PENDING:
            raise QuotationConflictError(
                f"Only a PENDING quotation can be accepted (current status: '{quotation.status}')."
            )

        # Ensure quotation belongs to the assigned worker
        if quotation.worker != booking.assigned_worker:
            raise QuotationConflictError("Quotation does not belong to the currently assigned worker.")

        # Ensure this is the latest revision
        latest_rev = Quotation.objects.filter(booking=booking).order_by('-revision_number').first()
        if latest_rev and latest_rev.id != quotation.id:
            raise QuotationConflictError("This quotation revision has been superseded by a newer revision.")

        now = timezone.now()
        quotation.status = QuotationStatus.ACCEPTED
        quotation.responded_at = now
        quotation.save(update_fields=['status', 'responded_at', 'updated_at'])

        booking.status = BookingStatus.QUOTE_ACCEPTED
        booking.save(update_fields=['status', 'updated_at'])

        record_audit_event(
            event_type=AuditEventType.QUOTATION_ACCEPTED,
            actor=customer,
            related_booking=booking,
            metadata={
                'quotation_id': quotation.id,
                'revision_number': quotation.revision_number,
                'total_amount': quotation.total_amount
            }
        )
        create_notification(
            recipient=quotation.worker.user,
            notification_type=NotificationType.QUOTATION_ACCEPTED,
            title="Quotation Accepted",
            message=f"The customer accepted quotation #{str(quotation.id)[:8]} (₹{quotation.total_amount}). You may now begin work.",
            related_booking=booking,
            idempotency_key=f"quote_accepted_{quotation.id}"
        )

    return quotation


def decline_quotation(booking_id, quotation_id, customer, reason: str = '') -> Quotation:
    """
    Declines a pending quotation. Reverts booking status to ASSIGNED,
    allowing the worker to submit a revised quotation.
    """
    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.customer != customer:
            raise PermissionError("You can only respond to quotations for your own bookings.")

        try:
            quotation = Quotation.objects.select_for_update().get(id=quotation_id, booking=booking)
        except Quotation.DoesNotExist:
            raise KeyError("Quotation not found for this booking.")

        if quotation.status != QuotationStatus.PENDING:
            raise QuotationConflictError(
                f"Only a PENDING quotation can be declined (current status: '{quotation.status}')."
            )

        now = timezone.now()
        quotation.status = QuotationStatus.DECLINED
        quotation.customer_notes = reason
        quotation.responded_at = now
        quotation.save(update_fields=['status', 'customer_notes', 'responded_at', 'updated_at'])

        # Booking reverts to ASSIGNED so the worker can provide an adjusted quote
        booking.status = BookingStatus.ASSIGNED
        booking.save(update_fields=['status', 'updated_at'])

        record_audit_event(
            event_type=AuditEventType.QUOTATION_DECLINED,
            actor=customer,
            related_booking=booking,
            metadata={
                'quotation_id': quotation.id,
                'revision_number': quotation.revision_number,
                'reason': reason
            }
        )
        create_notification(
            recipient=quotation.worker.user,
            notification_type=NotificationType.QUOTATION_DECLINED,
            title="Quotation Declined",
            message=f"The customer declined quotation #{str(quotation.id)[:8]}. You may submit a revised quotation.",
            related_booking=booking,
            idempotency_key=f"quote_declined_{quotation.id}"
        )

    return quotation


def start_work_on_booking(booking_id, worker: WorkerProfile) -> Booking:
    """
    Enforces the core business invariant:
    WORK MUST NEVER BEGIN BEFORE THE CUSTOMER HAS ACCEPTED THE CURRENT QUOTATION.
    """
    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.assigned_worker != worker:
            raise PermissionError("Only the assigned worker can start work on this booking.")

        if booking.status in [BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.EXPIRED]:
            raise QuotationStateError(f"Cannot start work on booking in '{booking.status}' status.")

        # Must have an accepted quotation
        accepted_quote = Quotation.objects.filter(
            booking=booking,
            worker=worker,
            status=QuotationStatus.ACCEPTED
        ).order_by('-revision_number').first()

        if not accepted_quote:
            raise QuotationStateError(
                "Work cannot begin: No customer-accepted quotation exists for this booking."
            )

        # Check booking is in QUOTE_ACCEPTED status
        if booking.status != BookingStatus.QUOTE_ACCEPTED:
            raise QuotationStateError(
                f"Work cannot begin: Booking must be in QUOTE_ACCEPTED status (current status: '{booking.status}')."
            )

        booking.status = BookingStatus.IN_PROGRESS
        booking.save(update_fields=['status', 'updated_at'])

        record_audit_event(
            event_type=AuditEventType.WORK_STARTED,
            actor=worker.user,
            related_booking=booking,
            metadata={'booking_id': booking.id}
        )
        create_notification(
            recipient=booking.customer,
            notification_type=NotificationType.WORK_STARTED,
            title="Work Started",
            message=f"The service professional has started work on your booking #{str(booking.id)[:8]}.",
            related_booking=booking,
            idempotency_key=f"work_started_{booking.id}"
        )

    return booking


def complete_work_on_booking(booking_id, worker: WorkerProfile) -> Booking:
    """
    Transitions booking from IN_PROGRESS to COMPLETED.
    """
    with transaction.atomic():
        try:
            booking = Booking.objects.select_for_update().get(id=booking_id)
        except Booking.DoesNotExist:
            raise KeyError("Booking not found.")

        if booking.assigned_worker != worker:
            raise PermissionError("Only the assigned worker can mark work as completed.")

        if booking.status != BookingStatus.IN_PROGRESS:
            raise QuotationStateError(
                f"Work cannot be completed: Booking must be in IN_PROGRESS status (current status: '{booking.status}')."
            )

        now = timezone.now()
        booking.status = BookingStatus.COMPLETED
        booking.save(update_fields=['status', 'updated_at'])

        record_audit_event(
            event_type=AuditEventType.WORK_COMPLETED,
            actor=worker.user,
            related_booking=booking,
            metadata={'booking_id': booking.id}
        )
        create_notification(
            recipient=booking.customer,
            notification_type=NotificationType.WORK_COMPLETED,
            title="Work Completed",
            message=f"The service professional has marked your booking #{str(booking.id)[:8]} as completed.",
            related_booking=booking,
            idempotency_key=f"work_completed_{booking.id}"
        )

    return booking
