import threading
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from django.db import connection
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from apps.services.models import ServiceCategory, Service, WorkerService
from apps.bookings.models import Booking, WorkerOffer, BookingStatus, OfferStatus
from apps.bookings.services.location import (
    haversine_distance_km,
    validate_coordinates,
    is_within_coimbatore_bounds,
)
from apps.bookings.services.dispatch import (
    find_eligible_workers,
    create_booking_and_dispatch,
    accept_worker_offer,
    reject_worker_offer,
    expire_stale_offers,
    ConflictError,
    OfferExpiredError,
    BookingStateError,
)


class LocationMatchingTestCase(TestCase):
    def test_identical_coordinates_return_zero_distance(self):
        dist = haversine_distance_km(11.016844, 76.955832, 11.016844, 76.955832)
        self.assertEqual(dist, 0.0)

    def test_known_coimbatore_coordinates_distance(self):
        # Gandhipuram (11.0183, 76.9644) to RS Puram (11.0089, 76.9482)
        dist = haversine_distance_km(11.0183, 76.9644, 11.0089, 76.9482)
        # Plausible distance: between 1.5 km and 2.5 km
        self.assertTrue(1.5 <= dist <= 2.5, f"Expected distance between 1.5 and 2.5 km, got {dist}")

    def test_invalid_coordinates_raise_value_error(self):
        with self.assertRaises(ValueError):
            validate_coordinates(95.0, 76.95)
        with self.assertRaises(ValueError):
            validate_coordinates(11.0, 190.0)

    def test_coimbatore_bounds_checker(self):
        self.assertTrue(is_within_coimbatore_bounds(11.0183, 76.9644))
        # Chennai coordinate should fail
        self.assertFalse(is_within_coimbatore_bounds(13.0827, 80.2707))


class BookingDispatchTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Category & Service
        self.category = ServiceCategory.objects.create(name="Plumbing", slug="plumbing", is_active=True)
        self.service = Service.objects.create(
            category=self.category,
            name="Pipe leakage repair",
            slug="pipe-leakage-repair",
            is_active=True
        )
        self.inactive_service = Service.objects.create(
            category=self.category,
            name="Old Service",
            slug="old-service",
            is_active=False
        )

        # Create Customer
        self.customer = User.objects.create_user(
            username="kavitha_cust",
            email="kavitha@test.com",
            password="Password123!",
            role=UserRole.CUSTOMER
        )
        # RS Puram address (11.008922, 76.948215)
        self.customer_address = Address.objects.create(
            user=self.customer,
            title="Home",
            address_line1="12 DB Road, RS Puram",
            city="Coimbatore",
            pincode="641002",
            latitude=Decimal('11.008922'),
            longitude=Decimal('76.948215')
        )

        # Other Customer
        self.other_customer = User.objects.create_user(
            username="other_cust",
            email="other@test.com",
            password="Password123!",
            role=UserRole.CUSTOMER
        )
        self.other_address = Address.objects.create(
            user=self.other_customer,
            title="Office",
            address_line1="Race Course",
            city="Coimbatore",
            pincode="641018",
            latitude=Decimal('11.005000'),
            longitude=Decimal('76.970000')
        )

        # Worker 1: Within 2 km (Gandhipuram: 11.018300, 76.964400), Approved, Offers Service
        self.worker1_user = User.objects.create_user(
            username="worker1",
            email="worker1@test.com",
            password="WorkerPassword123!",
            phone_number="9876543201",
            role=UserRole.WORKER
        )
        self.worker1_profile = WorkerProfile.objects.create(
            user=self.worker1_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(
            worker=self.worker1_profile,
            service=self.service,
            experience_years=5
        )

        # Worker 2: Within 3 km (Saibaba Colony: 11.025000, 76.945000), Approved, Offers Service
        self.worker2_user = User.objects.create_user(
            username="worker2",
            email="worker2@test.com",
            password="WorkerPassword123!",
            phone_number="9876543202",
            role=UserRole.WORKER
        )
        self.worker2_profile = WorkerProfile.objects.create(
            user=self.worker2_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal('11.025000'),
            longitude=Decimal('76.945000'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(
            worker=self.worker2_profile,
            service=self.service,
            experience_years=3
        )

        # Worker 3: Far away > 15 km (Pollachi road: 10.850000, 76.980000), Approved, Offers Service
        self.worker3_user = User.objects.create_user(
            username="worker_far",
            email="worker_far@test.com",
            password="WorkerPassword123!",
            phone_number="9876543203",
            role=UserRole.WORKER
        )
        self.worker3_profile = WorkerProfile.objects.create(
            user=self.worker3_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal('10.850000'),
            longitude=Decimal('76.980000'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(
            worker=self.worker3_profile,
            service=self.service,
            experience_years=2
        )

        # Worker 4: Nearby but Unapproved
        self.worker4_user = User.objects.create_user(
            username="worker_unapproved",
            email="worker_unapproved@test.com",
            password="WorkerPassword123!",
            phone_number="9876543204",
            role=UserRole.WORKER
        )
        self.worker4_profile = WorkerProfile.objects.create(
            user=self.worker4_user,
            approval_status=WorkerApprovalStatus.PENDING,
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(
            worker=self.worker4_profile,
            service=self.service,
            experience_years=1
        )

    def test_eligible_workers_filtering_radius_and_status(self):
        eligible = find_eligible_workers(
            service=self.service,
            customer_lat=float(self.customer_address.latitude),
            customer_lon=float(self.customer_address.longitude),
            search_radius_km=5.0
        )
        worker_ids = [w.id for w, _ in eligible]
        # Should include worker1 and worker2 (within 5 km and approved)
        self.assertIn(self.worker1_profile.id, worker_ids)
        self.assertIn(self.worker2_profile.id, worker_ids)
        # Should exclude worker3 (too far > 15 km)
        self.assertNotIn(self.worker3_profile.id, worker_ids)
        # Should exclude worker4 (unapproved)
        self.assertNotIn(self.worker4_profile.id, worker_ids)

    def test_customer_can_create_booking_via_api(self):
        self.client.force_authenticate(user=self.customer)
        url = reverse('booking_list_create')
        data = {
            "service_id": self.service.id,
            "address_id": self.customer_address.id,
            "problem_description": "Water dripping heavily from main bathroom PVC pipe joint."
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['dispatched_workers_count'], 2)
        booking_data = response.data['booking']
        self.assertEqual(booking_data['status'], BookingStatus.SEARCHING)

        # Verify offers created with 60s expiration
        booking = Booking.objects.get(id=booking_data['id'])
        offers = WorkerOffer.objects.filter(booking=booking)
        self.assertEqual(offers.count(), 2)
        for offer in offers:
            self.assertEqual(offer.status, OfferStatus.PENDING)
            diff = (offer.expires_at - offer.sent_at).total_seconds()
            self.assertTrue(58 <= diff <= 62)

    def test_unauthenticated_cannot_create_booking(self):
        self.client.logout()
        url = reverse('booking_list_create')
        data = {
            "service_id": self.service.id,
            "address_id": self.customer_address.id,
            "problem_description": "Testing unauthenticated request."
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_cannot_use_another_customer_address(self):
        self.client.force_authenticate(user=self.customer)
        url = reverse('booking_list_create')
        data = {
            "service_id": self.service.id,
            "address_id": self.other_address.id,  # Belongs to other_customer
            "problem_description": "Attempting to hijack another address."
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inactive_service_cannot_be_booked(self):
        self.client.force_authenticate(user=self.customer)
        url = reverse('booking_list_create')
        data = {
            "service_id": self.inactive_service.id,
            "address_id": self.customer_address.id,
            "problem_description": "Attempting to book deactivated service."
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_cancellation_invalidates_pending_offers(self):
        booking, count = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Test cancellation"
        )
        self.assertEqual(booking.status, BookingStatus.SEARCHING)
        self.assertEqual(count, 2)

        self.client.force_authenticate(user=self.customer)
        cancel_url = reverse('booking_cancel', kwargs={'pk': booking.id})
        res = self.client.post(cancel_url, {"reason": "Found neighbor plumber."}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.CANCELLED)
        
        # Verify all offers marked CANCELLED
        for offer in booking.offers.all():
            self.assertEqual(offer.status, OfferStatus.CANCELLED)

    def test_worker_can_accept_and_wins_assignment(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Test acceptance"
        )
        offer1 = WorkerOffer.objects.get(booking=booking, worker=self.worker1_profile)
        offer2 = WorkerOffer.objects.get(booking=booking, worker=self.worker2_profile)

        self.client.force_authenticate(user=self.worker1_user)
        accept_url = reverse('worker_offers_accept', kwargs={'pk': offer1.id})
        res = self.client.post(accept_url, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        offer1.refresh_from_db()
        offer2.refresh_from_db()

        self.assertEqual(booking.status, BookingStatus.ASSIGNED)
        self.assertEqual(booking.assigned_worker, self.worker1_profile)
        self.assertEqual(offer1.status, OfferStatus.ACCEPTED)
        self.assertEqual(offer2.status, OfferStatus.MISSED)

    def test_second_worker_gets_conflict_response(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Test second worker conflict"
        )
        offer1 = WorkerOffer.objects.get(booking=booking, worker=self.worker1_profile)
        offer2 = WorkerOffer.objects.get(booking=booking, worker=self.worker2_profile)

        # Worker 1 accepts first
        accept_worker_offer(offer1.id, self.worker1_profile)

        # Worker 2 attempts acceptance
        self.client.force_authenticate(user=self.worker2_user)
        accept_url = reverse('worker_offers_accept', kwargs={'pk': offer2.id})
        res = self.client.post(accept_url, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)

        # Worker 1 remains the sole winner
        booking.refresh_from_db()
        self.assertEqual(booking.assigned_worker, self.worker1_profile)

    def test_expired_offer_cannot_be_accepted(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Test expired acceptance"
        )
        offer1 = WorkerOffer.objects.get(booking=booking, worker=self.worker1_profile)
        # Fast forward expiration to 10 seconds ago
        offer1.expires_at = timezone.now() - timedelta(seconds=10)
        offer1.save(update_fields=['expires_at'])

        self.client.force_authenticate(user=self.worker1_user)
        accept_url = reverse('worker_offers_accept', kwargs={'pk': offer1.id})
        res = self.client.post(accept_url, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("expired", res.data['error'].lower())

    def test_worker_cannot_accept_another_worker_offer(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Test authorization"
        )
        offer1 = WorkerOffer.objects.get(booking=booking, worker=self.worker1_profile)

        # Worker 2 tries to accept Worker 1's offer
        self.client.force_authenticate(user=self.worker2_user)
        accept_url = reverse('worker_offers_accept', kwargs={'pk': offer1.id})
        res = self.client.post(accept_url, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_can_retry_after_expiration(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Test retry dispatch"
        )
        # Fast forward offers to expired
        WorkerOffer.objects.filter(booking=booking).update(
            expires_at=timezone.now() - timedelta(seconds=10)
        )
        expire_stale_offers()

        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.EXPIRED)

        # Customer triggers retry
        self.client.force_authenticate(user=self.customer)
        retry_url = reverse('booking_retry', kwargs={'pk': booking.id})
        res = self.client.post(retry_url, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        self.assertEqual(booking.status, BookingStatus.SEARCHING)
        self.assertEqual(booking.dispatch_round, 2)
        
        # New offers created for round 2
        round2_offers = WorkerOffer.objects.filter(booking=booking, dispatch_round=2)
        self.assertEqual(round2_offers.count(), 2)


class ConcurrencyWorkerAcceptanceTestCase(TransactionTestCase):
    """
    Tests atomic acceptance under simulated concurrent multi-threaded execution
    directly against PostgreSQL row locking (select_for_update).
    """
    def setUp(self):
        self.category = ServiceCategory.objects.create(name="Plumbing", slug="plumbing-conc", is_active=True)
        self.service = Service.objects.create(
            category=self.category,
            name="Tap Leakage Concurrency",
            slug="tap-leakage-concurrency",
            is_active=True
        )
        self.customer = User.objects.create_user(
            username="conc_cust",
            email="conc_cust@test.com",
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

        # Worker A
        self.workerA_user = User.objects.create_user(
            username="workerA",
            email="workerA@test.com",
            password="WorkerPassword123!",
            phone_number="9876543301",
            role=UserRole.WORKER
        )
        self.workerA_profile = WorkerProfile.objects.create(
            user=self.workerA_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(
            worker=self.workerA_profile,
            service=self.service,
            experience_years=5
        )

        # Worker B
        self.workerB_user = User.objects.create_user(
            username="workerB",
            email="workerB@test.com",
            password="WorkerPassword123!",
            phone_number="9876543302",
            role=UserRole.WORKER
        )
        self.workerB_profile = WorkerProfile.objects.create(
            user=self.workerB_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal('11.018300'),
            longitude=Decimal('76.964400'),
            service_radius_km=Decimal('5.0'),
            is_available=True,
            is_active=True
        )
        WorkerService.objects.create(
            worker=self.workerB_profile,
            service=self.service,
            experience_years=4
        )

    def test_concurrent_worker_acceptance_exactly_one_winner(self):
        booking, count = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.customer_address,
            problem_description="Concurrent acceptance race condition test"
        )
        self.assertEqual(count, 2)
        
        offerA = WorkerOffer.objects.get(booking=booking, worker=self.workerA_profile)
        offerB = WorkerOffer.objects.get(booking=booking, worker=self.workerB_profile)

        results = {}

        def accept_worker(worker_name, offer_id, profile):
            # Close connection so thread obtains a distinct PostgreSQL connection
            connection.close()
            try:
                accept_worker_offer(offer_id, profile)
                results[worker_name] = "SUCCESS"
            except ConflictError as e:
                results[worker_name] = f"CONFLICT: {str(e)}"
            except Exception as e:
                results[worker_name] = f"ERROR: {type(e).__name__} - {str(e)}"
            finally:
                connection.close()

        # Launch two parallel threads attempting acceptance simultaneously
        t1 = threading.Thread(target=accept_worker, args=("WorkerA", offerA.id, self.workerA_profile))
        t2 = threading.Thread(target=accept_worker, args=("WorkerB", offerB.id, self.workerB_profile))

        t1.start()
        t2.start()

        t1.join()
        t2.join()

        # Exactly ONE must have won ("SUCCESS"), the other must have encountered a CONFLICT
        statuses = list(results.values())
        self.assertEqual(statuses.count("SUCCESS"), 1, f"Expected exactly 1 success, got results: {results}")
        conflict_count = sum(1 for s in statuses if s.startswith("CONFLICT"))
        self.assertEqual(conflict_count, 1, f"Expected exactly 1 conflict, got results: {results}")

        # Verify booking in database has exactly one assigned worker
        booking.refresh_from_db()
        self.assertIsNotNone(booking.assigned_worker)
        self.assertEqual(booking.status, BookingStatus.ASSIGNED)

        # Verify offer states
        offerA.refresh_from_db()
        offerB.refresh_from_db()
        offer_statuses = {offerA.status, offerB.status}
        self.assertEqual(offer_statuses, {OfferStatus.ACCEPTED, OfferStatus.MISSED})
