from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from apps.services.models import ServiceCategory, Service, WorkerService
from apps.bookings.models import Booking, BookingStatus, WorkerOffer, OfferStatus
from apps.bookings.services.dispatch import find_eligible_workers


class LocationTrackingTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Category and Service
        self.category = ServiceCategory.objects.create(name="Electrical", slug="electrical", is_active=True)
        self.service = Service.objects.create(category=self.category, name="Fan Repair", slug="fan-repair", is_active=True)

        # Create Customer A
        self.customer = User.objects.create_user(
            username="cbe_customer_1",
            password="Customer@123",
            role=UserRole.CUSTOMER
        )
        self.address = Address.objects.create(
            user=self.customer,
            title="Home",
            address_line1="100 DB Road, RS Puram",
            city="Coimbatore",
            pincode="641002",
            latitude=Decimal("11.012500"),
            longitude=Decimal("76.952000")
        )

        # Create Customer B (unrelated)
        self.other_customer = User.objects.create_user(
            username="other_customer",
            password="Customer@123",
            role=UserRole.CUSTOMER
        )

        # Create Worker 1 (Approved)
        self.worker1_user = User.objects.create_user(
            username="electrician_1",
            password="Worker@123",
            role=UserRole.WORKER
        )
        self.worker1_profile = WorkerProfile.objects.create(
            user=self.worker1_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal("11.016800"),
            longitude=Decimal("76.955800"),
            service_radius_km=Decimal("5.0"),
            is_available=True,
            is_active=True,
            is_location_sharing_enabled=True,
            last_location_updated_at=timezone.now()
        )
        WorkerService.objects.create(
            worker=self.worker1_profile,
            service=self.service,
            is_active=True
        )

        # Create Worker 2 (Unrelated worker)
        self.worker2_user = User.objects.create_user(
            username="electrician_2",
            password="Worker@123",
            role=UserRole.WORKER
        )
        self.worker2_profile = WorkerProfile.objects.create(
            user=self.worker2_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            latitude=Decimal("11.020000"),
            longitude=Decimal("76.960000"),
            is_available=True,
            is_active=True,
            is_location_sharing_enabled=True,
            last_location_updated_at=timezone.now()
        )

    # -------------------------------------------------------------------------
    # Worker Location Updates & Throttling
    # -------------------------------------------------------------------------

    def test_worker_can_update_valid_location(self):
        self.client.force_authenticate(user=self.worker1_user)
        # Advance last update to avoid 5s throttle from setUp
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(seconds=10)
        self.worker1_profile.save()

        res = self.client.post('/api/workers/me/location/', {
            "latitude": 11.0180,
            "longitude": 76.9570,
            "is_location_sharing_enabled": True
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['latitude'], 11.018)
        self.assertEqual(res.data['longitude'], 76.957)
        self.assertTrue(res.data['is_location_sharing_enabled'])

        # Verify profile was updated in DB
        self.worker1_profile.refresh_from_db()
        self.assertEqual(float(self.worker1_profile.latitude), 11.018)
        self.assertEqual(float(self.worker1_profile.longitude), 76.957)

    def test_invalid_coordinates_rejected(self):
        self.client.force_authenticate(user=self.worker1_user)
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(seconds=10)
        self.worker1_profile.save()

        # Latitude out of bounds (> 90)
        res = self.client.post('/api/workers/me/location/', {
            "latitude": 95.0000,
            "longitude": 76.9570
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        # Longitude out of bounds (> 180)
        res2 = self.client.post('/api/workers/me/location/', {
            "latitude": 11.0180,
            "longitude": 200.0000
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_customer_cannot_update_worker_location(self):
        self.client.force_authenticate(user=self.customer)
        res = self.client.post('/api/workers/me/location/', {
            "latitude": 11.0180,
            "longitude": 76.9570
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_worker_cannot_update_another_worker_location(self):
        self.client.force_authenticate(user=self.worker1_user)
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(seconds=10)
        self.worker1_profile.save()

        # Worker 1 tries to send payload with worker2 id
        res = self.client.post('/api/workers/me/location/', {
            "worker_id": self.worker2_profile.id,
            "latitude": 11.0333,
            "longitude": 76.9777
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Worker 2 profile must remain untouched
        self.worker2_profile.refresh_from_db()
        self.assertNotEqual(float(self.worker2_profile.latitude), 11.0333)

    def test_location_update_timestamps_are_server_controlled(self):
        self.client.force_authenticate(user=self.worker1_user)
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(seconds=10)
        self.worker1_profile.save()

        before = timezone.now()
        res = self.client.post('/api/workers/me/location/', {
            "latitude": 11.0175,
            "longitude": 76.9565,
            "last_location_updated_at": "2020-01-01T00:00:00Z"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.worker1_profile.refresh_from_db()
        # Server must have set timestamp to current time, not client's spoofed 2020 timestamp
        self.assertTrue(self.worker1_profile.last_location_updated_at >= before - timedelta(seconds=2))

    def test_location_update_throttling(self):
        self.client.force_authenticate(user=self.worker1_user)
        # Advance time so first call passes
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(seconds=10)
        self.worker1_profile.save()

        # First update succeeds
        res1 = self.client.post('/api/workers/me/location/', {"latitude": 11.0171, "longitude": 76.9561})
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Immediate second update should be throttled (within 5 seconds)
        res2 = self.client.post('/api/workers/me/location/', {"latitude": 11.0172, "longitude": 76.9562})
        self.assertEqual(res2.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    # -------------------------------------------------------------------------
    # Nearby Worker Matching & Freshness Rules
    # -------------------------------------------------------------------------

    def test_dispatch_excludes_stale_worker_location(self):
        # Set worker location to 2 hours ago (threshold is 60 minutes)
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(hours=2)
        self.worker1_profile.save()

        eligible = find_eligible_workers(
            service=self.service,
            customer_lat=11.0125,
            customer_lon=76.9520,
            search_radius_km=5.0
        )
        # Stale worker must NOT be returned
        self.assertEqual(len(eligible), 0)

    def test_dispatch_excludes_worker_with_location_sharing_paused(self):
        self.worker1_profile.is_location_sharing_enabled = False
        self.worker1_profile.last_location_updated_at = timezone.now()
        self.worker1_profile.save()

        eligible = find_eligible_workers(
            service=self.service,
            customer_lat=11.0125,
            customer_lon=76.9520,
            search_radius_km=5.0
        )
        self.assertEqual(len(eligible), 0)

    def test_dispatch_includes_worker_with_fresh_location(self):
        self.worker1_profile.is_location_sharing_enabled = True
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(minutes=5)
        self.worker1_profile.save()

        eligible = find_eligible_workers(
            service=self.service,
            customer_lat=11.0125,
            customer_lon=76.9520,
            search_radius_km=5.0
        )
        self.assertEqual(len(eligible), 1)
        self.assertEqual(eligible[0][0].id, self.worker1_profile.id)

    # -------------------------------------------------------------------------
    # Booking Live Tracking Permissions & Lifecycle
    # -------------------------------------------------------------------------

    def test_unassigned_booking_does_not_reveal_worker_coordinates(self):
        # Booking in SEARCHING status without assigned worker
        booking = Booking.objects.create(
            customer=self.customer,
            service=self.service,
            problem_description="Ceiling fan wobbling",
            service_address_title="Home",
            service_address_line="100 DB Road",
            service_city="Coimbatore",
            service_pincode="641002",
            service_latitude=Decimal("11.012500"),
            service_longitude=Decimal("76.952000"),
            status=BookingStatus.SEARCHING
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(f'/api/bookings/{booking.id}/tracking/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['tracking_available'])
        self.assertNotIn('worker_latitude', res.data)

    def test_assigned_customer_can_track_worker_location(self):
        booking = Booking.objects.create(
            customer=self.customer,
            service=self.service,
            assigned_worker=self.worker1_profile,
            problem_description="Ceiling fan wobbling",
            service_address_title="Home",
            service_address_line="100 DB Road",
            service_city="Coimbatore",
            service_pincode="641002",
            service_latitude=Decimal("11.012500"),
            service_longitude=Decimal("76.952000"),
            status=BookingStatus.IN_PROGRESS
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(f'/api/bookings/{booking.id}/tracking/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['tracking_available'])
        self.assertEqual(res.data['worker_latitude'], 11.0168)
        self.assertEqual(res.data['worker_longitude'], 76.9558)
        self.assertFalse(res.data['is_stale'])
        self.assertIsNotNone(res.data['distance_km'])

    def test_customer_cannot_track_another_customers_booking(self):
        booking = Booking.objects.create(
            customer=self.customer,
            service=self.service,
            assigned_worker=self.worker1_profile,
            problem_description="Ceiling fan wobbling",
            service_address_title="Home",
            service_address_line="100 DB Road",
            service_city="Coimbatore",
            service_pincode="641002",
            service_latitude=Decimal("11.012500"),
            service_longitude=Decimal("76.952000"),
            status=BookingStatus.IN_PROGRESS
        )

        # Other customer tries to track booking
        self.client.force_authenticate(user=self.other_customer)
        res = self.client.get(f'/api/bookings/{booking.id}/tracking/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_unrelated_worker_cannot_track_booking(self):
        booking = Booking.objects.create(
            customer=self.customer,
            service=self.service,
            assigned_worker=self.worker1_profile,
            problem_description="Ceiling fan wobbling",
            service_address_title="Home",
            service_address_line="100 DB Road",
            service_city="Coimbatore",
            service_pincode="641002",
            service_latitude=Decimal("11.012500"),
            service_longitude=Decimal("76.952000"),
            status=BookingStatus.IN_PROGRESS
        )

        # Worker 2 (not assigned) tries to access tracking
        self.client.force_authenticate(user=self.worker2_user)
        res = self.client.get(f'/api/bookings/{booking.id}/tracking/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_completed_booking_stops_tracking(self):
        booking = Booking.objects.create(
            customer=self.customer,
            service=self.service,
            assigned_worker=self.worker1_profile,
            problem_description="Ceiling fan wobbling",
            service_address_title="Home",
            service_address_line="100 DB Road",
            service_city="Coimbatore",
            service_pincode="641002",
            service_latitude=Decimal("11.012500"),
            service_longitude=Decimal("76.952000"),
            status=BookingStatus.COMPLETED
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(f'/api/bookings/{booking.id}/tracking/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['tracking_available'])
        self.assertIn("completed", res.data['reason'].lower())

    def test_stale_worker_location_flagged_in_tracking(self):
        # Set worker location update to 30 minutes ago (tracking threshold is 15 minutes)
        self.worker1_profile.last_location_updated_at = timezone.now() - timedelta(minutes=30)
        self.worker1_profile.save()

        booking = Booking.objects.create(
            customer=self.customer,
            service=self.service,
            assigned_worker=self.worker1_profile,
            problem_description="Ceiling fan wobbling",
            service_address_title="Home",
            service_address_line="100 DB Road",
            service_city="Coimbatore",
            service_pincode="641002",
            service_latitude=Decimal("11.012500"),
            service_longitude=Decimal("76.952000"),
            status=BookingStatus.IN_PROGRESS
        )

        self.client.force_authenticate(user=self.customer)
        res = self.client.get(f'/api/bookings/{booking.id}/tracking/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['tracking_available'])
        self.assertTrue(res.data['is_stale'])
