import threading
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.db import connection
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from apps.services.models import ServiceCategory, Service, WorkerService
from apps.bookings.models import Booking, BookingStatus
from apps.bookings.services.dispatch import create_booking_and_dispatch, accept_worker_offer
from apps.quotations.models import Quotation, QuotationItem, QuotationStatus, ItemType
from apps.quotations.services.quotation_service import (
    create_or_revise_quotation,
    accept_quotation,
    decline_quotation,
    start_work_on_booking,
    QuotationConflictError,
    QuotationStateError
)


class QuotationWorkflowTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Customer 1
        self.customer = User.objects.create_user(
            username="cust_quote",
            email="cust_quote@test.com",
            password="Password123!",
            role=UserRole.CUSTOMER
        )
        self.customer_address = Address.objects.create(
            user=self.customer,
            title="Home",
            address_line1="12 DB Road, RS Puram",
            city="Coimbatore",
            pincode="641002",
            latitude=Decimal('11.008922'),
            longitude=Decimal('76.948215')
        )

        # Customer 2 (other customer)
        self.other_customer = User.objects.create_user(
            username="other_cust_quote",
            email="other_cust_quote@test.com",
            password="Password123!",
            role=UserRole.CUSTOMER
        )

        # Service
        self.category = ServiceCategory.objects.create(name="Plumbing", slug="plumbing-q", is_active=True)
        self.service = Service.objects.create(
            category=self.category,
            name="Pipe Repair",
            slug="pipe-repair-q",
            is_active=True
        )

        # Assigned Worker (Worker 1)
        self.worker1_user = User.objects.create_user(
            username="worker1_quote",
            email="worker1_quote@test.com",
            password="WorkerPassword123!",
            phone_number="9876543111",
            role=UserRole.WORKER
        )
        self.worker1_profile = WorkerProfile.objects.create(
            user=self.worker1_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            business_name="Worker 1 Plumbing",
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(worker=self.worker1_profile, service=self.service)

        # Unassigned Worker (Worker 2)
        self.worker2_user = User.objects.create_user(
            username="worker2_unassigned",
            email="worker2_unassigned@test.com",
            password="WorkerPassword123!",
            phone_number="9876543112",
            role=UserRole.WORKER
        )
        self.worker2_profile = WorkerProfile.objects.create(
            user=self.worker2_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(worker=self.worker2_profile, service=self.service)

        # Create booking and assign Worker 1
        self.booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Leaking kitchen sink valve"
        )
        offer1 = self.booking.offers.get(worker=self.worker1_profile)
        accept_worker_offer(offer1.id, self.worker1_profile)
        self.booking.refresh_from_db()

    # 1. Assigned worker can submit a valid quotation.
    def test_assigned_worker_can_submit_valid_quotation(self):
        self.client.force_authenticate(user=self.worker1_user)
        url = reverse('booking_quotations_list_create', kwargs={'booking_id': self.booking.id})
        data = {
            "work_description": "Replace copper valve and install new flexible connector.",
            "labor_charge": "350.00",
            "materials_charge": "250.00",
            "other_charges": "50.00",
            "notes": "Includes 30 days warranty on fittings."
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, BookingStatus.QUOTE_PENDING)
        quote = Quotation.objects.get(booking=self.booking)
        self.assertEqual(quote.labor_charge, Decimal('350.00'))
        self.assertEqual(quote.materials_charge, Decimal('250.00'))
        self.assertEqual(quote.other_charges, Decimal('50.00'))
        self.assertEqual(quote.total_amount, Decimal('650.00'))
        self.assertEqual(quote.status, QuotationStatus.PENDING)

    # 2. Unassigned worker cannot submit a quotation.
    def test_unassigned_worker_cannot_submit_quotation(self):
        self.client.force_authenticate(user=self.worker2_user)
        url = reverse('booking_quotations_list_create', kwargs={'booking_id': self.booking.id})
        data = {
            "work_description": "Attempting unassigned submission.",
            "labor_charge": "100.00"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 3. Customer cannot submit a worker quotation.
    def test_customer_cannot_submit_quotation(self):
        self.client.force_authenticate(user=self.customer)
        url = reverse('booking_quotations_list_create', kwargs={'booking_id': self.booking.id})
        data = {
            "work_description": "Customer trying to set price.",
            "labor_charge": "50.00"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 4. Customer can view their own quotation.
    def test_customer_can_view_own_quotation(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Fix valve",
            labor_charge=Decimal('300.00'),
            materials_charge=Decimal('100.00')
        )
        self.client.force_authenticate(user=self.customer)
        url = reverse('booking_quotation_detail', kwargs={'booking_id': self.booking.id, 'pk': quote.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_amount'], '400.00')

    # 5. Customer cannot access another customer's quotation.
    def test_customer_cannot_access_another_customer_quotation(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Fix valve",
            labor_charge=Decimal('300.00')
        )
        self.client.force_authenticate(user=self.other_customer)
        url = reverse('booking_quotation_detail', kwargs={'booking_id': self.booking.id, 'pk': quote.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 6. Total is calculated correctly by the server (ignores or rejects client tampering).
    def test_total_is_calculated_strictly_on_server(self):
        self.client.force_authenticate(user=self.worker1_user)
        url = reverse('booking_quotations_list_create', kwargs={'booking_id': self.booking.id})
        data = {
            "work_description": "Server calculation verification.",
            "labor_charge": "200.50",
            "materials_charge": "150.25",
            "other_charges": "49.25",
            # Attempting to submit tampered total
            "total_amount": "10.00"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quote = Quotation.objects.get(id=response.data['quotation']['id'])
        # Correct total: 200.50 + 150.25 + 49.25 = 400.00
        self.assertEqual(quote.total_amount, Decimal('400.00'))

    # 7. Negative charges and invalid decimal amounts are rejected.
    def test_negative_charges_rejected(self):
        self.client.force_authenticate(user=self.worker1_user)
        url = reverse('booking_quotations_list_create', kwargs={'booking_id': self.booking.id})
        data = {
            "work_description": "Negative price attempt.",
            "labor_charge": "-100.00",
            "materials_charge": "50.00"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # 8. Itemized line calculations are correct and authoritative.
    def test_itemized_line_calculations_are_authoritative(self):
        self.client.force_authenticate(user=self.worker1_user)
        url = reverse('booking_quotations_list_create', kwargs={'booking_id': self.booking.id})
        data = {
            "work_description": "Itemized plumbing repair.",
            "items": [
                {
                    "item_type": ItemType.LABOR,
                    "description": "Pipe cutting and threading",
                    "quantity": "2.00",
                    "unit_price": "150.00"  # 300.00
                },
                {
                    "item_type": ItemType.MATERIAL,
                    "description": "Brass ball valve 1/2 inch",
                    "quantity": "1.00",
                    "unit_price": "220.00"  # 220.00
                },
                {
                    "item_type": ItemType.OTHER,
                    "description": "Teflon tape and sealant paste",
                    "quantity": "2.00",
                    "unit_price": "25.00"  # 50.00
                }
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        quote = Quotation.objects.get(id=response.data['quotation']['id'])
        self.assertEqual(quote.labor_charge, Decimal('300.00'))
        self.assertEqual(quote.materials_charge, Decimal('220.00'))
        self.assertEqual(quote.other_charges, Decimal('50.00'))
        self.assertEqual(quote.total_amount, Decimal('570.00'))
        self.assertEqual(quote.items.count(), 3)

    # 9. Duplicate pending quotations handled: previous is marked SUPERSEDED.
    # 10. Revised quotations preserve the original history.
    def test_revised_quotation_supersedes_previous_and_preserves_history(self):
        quote_rev1 = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="First inspection quote",
            labor_charge=Decimal('300.00'),
            materials_charge=Decimal('100.00')
        )
        self.assertEqual(quote_rev1.revision_number, 1)
        self.assertEqual(quote_rev1.status, QuotationStatus.PENDING)

        # Worker submits revision 2
        quote_rev2 = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Revised after deeper pipe inspection",
            labor_charge=Decimal('350.00'),
            materials_charge=Decimal('150.00')
        )
        self.assertEqual(quote_rev2.revision_number, 2)
        self.assertEqual(quote_rev2.status, QuotationStatus.PENDING)

        # History preserved: Revision 1 is SUPERSEDED, not deleted or overwritten!
        quote_rev1.refresh_from_db()
        self.assertEqual(quote_rev1.status, QuotationStatus.SUPERSEDED)
        self.assertEqual(self.booking.quotations.count(), 2)

    # 11. Customer can accept the current pending quotation.
    def test_customer_can_accept_current_pending_quotation(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Valve fix",
            labor_charge=Decimal('250.00')
        )
        self.client.force_authenticate(user=self.customer)
        url = reverse('booking_quotation_accept', kwargs={'booking_id': self.booking.id, 'pk': quote.id})
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        quote.refresh_from_db()
        self.booking.refresh_from_db()
        self.assertEqual(quote.status, QuotationStatus.ACCEPTED)
        self.assertIsNotNone(quote.responded_at)
        self.assertEqual(self.booking.status, BookingStatus.QUOTE_ACCEPTED)

    # 12. Customer can decline the current pending quotation.
    def test_customer_can_decline_current_pending_quotation(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Pricey repair",
            labor_charge=Decimal('800.00')
        )
        self.client.force_authenticate(user=self.customer)
        url = reverse('booking_quotation_decline', kwargs={'booking_id': self.booking.id, 'pk': quote.id})
        response = self.client.post(url, {"reason": "Labor rate exceeds budget."}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        quote.refresh_from_db()
        self.booking.refresh_from_db()
        self.assertEqual(quote.status, QuotationStatus.DECLINED)
        self.assertEqual(quote.customer_notes, "Labor rate exceeds budget.")
        # Booking reverts to ASSIGNED to permit revision
        self.assertEqual(self.booking.status, BookingStatus.ASSIGNED)

    # 13. A second response cannot change an already finalized quotation.
    def test_second_response_cannot_change_finalized_quotation(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Valve fix",
            labor_charge=Decimal('250.00')
        )
        accept_quotation(self.booking.id, quote.id, self.customer)

        # Customer attempts to decline after acceptance
        self.client.force_authenticate(user=self.customer)
        decline_url = reverse('booking_quotation_decline', kwargs={'booking_id': self.booking.id, 'pk': quote.id})
        res = self.client.post(decline_url, {"reason": "Changed my mind"}, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        quote.refresh_from_db()
        self.assertEqual(quote.status, QuotationStatus.ACCEPTED)

    # 14. Old or superseded quotations cannot be accepted.
    def test_old_or_superseded_quotations_cannot_be_accepted(self):
        quote1 = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Quote 1",
            labor_charge=Decimal('200.00')
        )
        # Create quote 2, superseding quote 1
        quote2 = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Quote 2",
            labor_charge=Decimal('250.00')
        )
        self.client.force_authenticate(user=self.customer)
        # Attempt to accept superseded quote 1
        url = reverse('booking_quotation_accept', kwargs={'booking_id': self.booking.id, 'pk': quote1.id})
        res = self.client.post(url, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)

    # 15. Work cannot start without customer acceptance (CORE INVARIANT).
    def test_work_cannot_start_without_customer_acceptance(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Quote pending",
            labor_charge=Decimal('200.00')
        )
        # Booking is in QUOTE_PENDING, customer has NOT accepted yet
        self.client.force_authenticate(user=self.worker1_user)
        start_url = reverse('booking_start_work', kwargs={'booking_id': self.booking.id})
        response = self.client.post(start_url, format='json')
        # Core invariant: strictly rejected with 409 Conflict
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.booking.refresh_from_db()
        self.assertNotEqual(self.booking.status, BookingStatus.IN_PROGRESS)

    # 16. Work can start after valid acceptance by the assigned worker.
    def test_work_can_start_after_customer_acceptance(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Agreed valve replacement",
            labor_charge=Decimal('200.00')
        )
        accept_quotation(self.booking.id, quote.id, self.customer)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, BookingStatus.QUOTE_ACCEPTED)

        # Assigned worker starts work
        self.client.force_authenticate(user=self.worker1_user)
        start_url = reverse('booking_start_work', kwargs={'booking_id': self.booking.id})
        response = self.client.post(start_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, BookingStatus.IN_PROGRESS)

    # 17. An unrelated worker cannot start work.
    def test_unrelated_worker_cannot_start_work(self):
        quote = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker1_profile,
            work_description="Agreed work",
            labor_charge=Decimal('200.00')
        )
        accept_quotation(self.booking.id, quote.id, self.customer)

        # Worker 2 attempts to start work on Worker 1's booking
        self.client.force_authenticate(user=self.worker2_user)
        start_url = reverse('booking_start_work', kwargs={'booking_id': self.booking.id})
        response = self.client.post(start_url, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 18. Cancelled or expired bookings cannot proceed.
    def test_cancelled_booking_cannot_submit_or_accept_quotations(self):
        self.booking.status = BookingStatus.CANCELLED
        self.booking.save(update_fields=['status'])

        self.client.force_authenticate(user=self.worker1_user)
        url = reverse('booking_quotations_list_create', kwargs={'booking_id': self.booking.id})
        data = {
            "work_description": "Attempt on cancelled booking",
            "labor_charge": "100.00"
        }
        res = self.client.post(url, data, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)


class ConcurrencyQuotationResponseTestCase(TransactionTestCase):
    """
    Tests atomic concurrency for customer quotation responses using separate PostgreSQL
    database connections in multi-threaded environment.
    """
    def setUp(self):
        self.category = ServiceCategory.objects.create(name="Plumbing", slug="plumbing-qconc", is_active=True)
        self.service = Service.objects.create(
            category=self.category,
            name="Pipe Repair Concurrency",
            slug="pipe-repair-qconc",
            is_active=True
        )
        self.customer = User.objects.create_user(
            username="conc_cust_q",
            email="conc_cust_q@test.com",
            password="Password123!",
            role=UserRole.CUSTOMER
        )
        self.customer_address = Address.objects.create(
            user=self.customer,
            title="Home",
            address_line1="Gandhipuram",
            city="Coimbatore",
            pincode="641012",
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400')
        )
        self.worker_user = User.objects.create_user(
            username="worker_qconc",
            email="worker_qconc@test.com",
            password="WorkerPassword123!",
            phone_number="9876543999",
            role=UserRole.WORKER
        )
        self.worker_profile = WorkerProfile.objects.create(
            user=self.worker_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(worker=self.worker_profile, service=self.service)

        self.booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Concurrent quote response test"
        )
        offer = self.booking.offers.get(worker=self.worker_profile)
        accept_worker_offer(offer.id, self.worker_profile)
        self.booking.refresh_from_db()

        self.quotation = create_or_revise_quotation(
            booking=self.booking,
            worker=self.worker_profile,
            work_description="Pipe replacement concurrency test",
            labor_charge=Decimal('400.00'),
            materials_charge=Decimal('200.00')
        )

    # 19. Concurrent quotation responses cannot produce contradictory states.
    def test_concurrent_accept_and_decline_requests(self):
        results = {}

        def thread_accept():
            connection.close()
            try:
                accept_quotation(self.booking.id, self.quotation.id, self.customer)
                results['accept'] = 'SUCCESS'
            except QuotationConflictError as e:
                results['accept'] = f'CONFLICT: {str(e)}'
            except Exception as e:
                results['accept'] = f'ERROR: {type(e).__name__}'
            finally:
                connection.close()

        def thread_decline():
            connection.close()
            try:
                decline_quotation(self.booking.id, self.quotation.id, self.customer, reason="Too expensive")
                results['decline'] = 'SUCCESS'
            except QuotationConflictError as e:
                results['decline'] = f'CONFLICT: {str(e)}'
            except Exception as e:
                results['decline'] = f'ERROR: {type(e).__name__}'
            finally:
                connection.close()

        t1 = threading.Thread(target=thread_accept)
        t2 = threading.Thread(target=thread_decline)

        t1.start()
        t2.start()

        t1.join()
        t2.join()

        # Exactly ONE operation must succeed, the other must encounter conflict
        statuses = list(results.values())
        self.assertEqual(statuses.count("SUCCESS"), 1, f"Expected exactly 1 success, got results: {results}")
        conflict_count = sum(1 for s in statuses if s.startswith("CONFLICT"))
        self.assertEqual(conflict_count, 1, f"Expected exactly 1 conflict, got results: {results}")

        # Final database state must be unambiguous
        self.quotation.refresh_from_db()
        self.booking.refresh_from_db()
        self.assertIn(self.quotation.status, [QuotationStatus.ACCEPTED, QuotationStatus.DECLINED])
        if self.quotation.status == QuotationStatus.ACCEPTED:
            self.assertEqual(self.booking.status, BookingStatus.QUOTE_ACCEPTED)
        else:
            self.assertEqual(self.booking.status, BookingStatus.ASSIGNED)
