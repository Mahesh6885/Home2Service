from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.accounts.models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from apps.services.models import ServiceCategory, Service, WorkerService
from apps.bookings.models import (
    Booking,
    BookingStatus,
    WorkerOffer,
    OfferStatus,
    WorkerTravelStatus,
    NoShowReport,
    IncidentStatus
)
from apps.quotations.models import Quotation, QuotationStatus
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken


class Milestone8SecurityAndLifecycleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Customer A
        self.customer_a = User.objects.create_user(
            username='customer_ananya',
            email='ananya@example.com',
            phone_number='9876543201',
            password='TestPassword123!',
            role=UserRole.CUSTOMER,
            first_name='Ananya',
            last_name='Nair'
        )
        self.addr_a = Address.objects.create(
            user=self.customer_a,
            title='Home',
            address_line1='124 Race Course Road',
            city='Coimbatore',
            pincode='641018',
            latitude=Decimal('11.006200'),
            longitude=Decimal('76.978500'),
            is_default=True
        )

        # Customer B
        self.customer_b = User.objects.create_user(
            username='customer_bala',
            email='bala@example.com',
            phone_number='9876543202',
            password='TestPassword123!',
            role=UserRole.CUSTOMER,
            first_name='Bala',
            last_name='Murugan'
        )
        self.addr_b = Address.objects.create(
            user=self.customer_b,
            title='Office',
            address_line1='55 Gandhipuram 4th Street',
            city='Coimbatore',
            pincode='641012',
            latitude=Decimal('11.018500'),
            longitude=Decimal('76.965400')
        )

        # Worker 1 (Approved)
        self.worker_user1 = User.objects.create_user(
            username='worker_karthik',
            email='karthik@example.com',
            phone_number='9876543203',
            password='WorkerPassword123!',
            role=UserRole.WORKER,
            first_name='Karthik',
            last_name='R'
        )
        self.worker1 = WorkerProfile.objects.create(
            user=self.worker_user1,
            approval_status=WorkerApprovalStatus.APPROVED,
            is_active=True,
            is_available=True,
            is_location_sharing_enabled=True,
            service_radius_km=Decimal('8.0'),
            latitude=Decimal('11.010000'),
            longitude=Decimal('76.970000'),
            last_location_updated_at=timezone.now()
        )

        # Worker 2 (Approved)
        self.worker_user2 = User.objects.create_user(
            username='worker_prakash',
            email='prakash@example.com',
            phone_number='9876543204',
            password='WorkerPassword123!',
            role=UserRole.WORKER,
            first_name='Prakash',
            last_name='S'
        )
        self.worker2 = WorkerProfile.objects.create(
            user=self.worker_user2,
            approval_status=WorkerApprovalStatus.APPROVED,
            is_active=True,
            is_available=True,
            is_location_sharing_enabled=True,
            service_radius_km=Decimal('8.0'),
            latitude=Decimal('11.012000'),
            longitude=Decimal('76.971000'),
            last_location_updated_at=timezone.now()
        )

        # Admin
        self.admin_user = User.objects.create_user(
            username='admin_suresh',
            email='admin@home2service.com',
            phone_number='9876543205',
            password='AdminPassword123!',
            role=UserRole.ADMIN,
            is_staff=True
        )

        # Service Catalog
        self.cat = ServiceCategory.objects.create(
            name='Electrical Services',
            slug='electrical',
            is_active=True
        )
        self.srv = Service.objects.create(
            category=self.cat,
            name='Ceiling Fan Installation',
            slug='ceiling-fan-installation',
            is_active=True
        )
        WorkerService.objects.create(worker=self.worker1, service=self.srv, is_active=True)
        WorkerService.objects.create(worker=self.worker2, service=self.srv, is_active=True)

    # -------------------------------------------------------------------------
    # 1. AUTHENTICATION & TOKEN SECURITY
    # -------------------------------------------------------------------------

    def test_health_check_endpoint(self):
        """Verifies operational health check endpoint tests PostgreSQL connection."""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'healthy')
        self.assertEqual(response.data.get('database'), 'connected')

    def test_login_returns_generic_error_on_bad_credentials(self):
        """Verifies failed login returns generic privacy-safe error preventing enumeration."""
        response = self.client.post(reverse('token_obtain_pair'), {
            'username': 'non_existent_user',
            'password': 'WrongPassword123!'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        # Should not reveal whether user exists
        detail = str(response.data)
        self.assertIn("Invalid credentials", detail)

    def test_logout_blacklists_refresh_token(self):
        """Verifies that calling /api/auth/logout/ permanently revokes the refresh token."""
        refresh = RefreshToken.for_user(self.customer_a)
        refresh_str = str(refresh)
        access_str = str(refresh.access_token)

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_str}')
        logout_response = self.client.post('/api/auth/logout/', {'refresh': refresh_str}, format='json')
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)
        self.assertIn("revoked", logout_response.data['message'])

        # Now attempting to use the blacklisted refresh token MUST be rejected
        refresh_res = self.client.post(reverse('token_refresh'), {'refresh': refresh_str}, format='json')
        self.assertEqual(refresh_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_token_rotation_blacklists_old_refresh_token(self):
        """Verifies that rotating a refresh token revokes the previous token."""
        refresh = RefreshToken.for_user(self.customer_a)
        refresh_str = str(refresh)

        # Refresh token to mint new access and refresh token
        res = self.client.post(reverse('token_refresh'), {'refresh': refresh_str}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        new_refresh = res.data.get('refresh')
        self.assertIsNotNone(new_refresh)

        # Attempting to reuse the rotated old refresh token MUST fail
        reuse_res = self.client.post(reverse('token_refresh'), {'refresh': refresh_str}, format='json')
        self.assertEqual(reuse_res.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------------------
    # 2. OBJECT-LEVEL AUTHORIZATION & TENANT ISOLATION
    # -------------------------------------------------------------------------

    def test_customer_cannot_access_another_customers_address(self):
        """Customer A cannot view, edit, or delete Customer B's address."""
        self.client.force_authenticate(user=self.customer_a)
        # Customer B's address
        url = reverse('address_detail', kwargs={'pk': self.addr_b.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Tampered update
        patch_res = self.client.patch(url, {'address_line1': 'Hacked Street'}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_customer_cannot_access_another_customers_booking(self):
        """Customer B cannot view or tamper with Customer A's booking."""
        booking = Booking.objects.create(
            customer=self.customer_a,
            service=self.srv,
            service_address_line='124 Race Course Road',
            service_city='Coimbatore',
            service_pincode='641018',
            service_latitude=Decimal('11.006200'),
            service_longitude=Decimal('76.978500'),
            problem_description='Ceiling fan making squeaking noise',
            status=BookingStatus.REQUESTED
        )

        self.client.force_authenticate(user=self.customer_b)
        url = reverse('booking_detail', kwargs={'pk': booking.id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        cancel_url = reverse('booking_cancel', kwargs={'pk': booking.id})
        cancel_res = self.client.post(cancel_url, {'reason': 'Malicious cancel'}, format='json')
        self.assertEqual(cancel_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_worker_cannot_access_or_accept_another_workers_offer(self):
        """Worker 2 cannot view or accept Worker 1's broadcast offer."""
        booking = Booking.objects.create(
            customer=self.customer_a,
            service=self.srv,
            service_address_line='124 Race Course Road',
            service_city='Coimbatore',
            service_pincode='641018',
            service_latitude=Decimal('11.006200'),
            service_longitude=Decimal('76.978500'),
            problem_description='Ceiling fan repair',
            status=BookingStatus.SEARCHING
        )
        offer1 = WorkerOffer.objects.create(
            booking=booking,
            worker=self.worker1,
            dispatch_round=1,
            expires_at=timezone.now() + timedelta(seconds=60),
            status=OfferStatus.PENDING
        )

        # Worker 2 attempts to inspect or accept Worker 1's offer
        self.client.force_authenticate(user=self.worker_user2)
        res = self.client.get(reverse('worker_offers_detail', kwargs={'pk': offer1.id}))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        accept_res = self.client.post(reverse('worker_offers_accept', kwargs={'pk': offer1.id}))
        self.assertEqual(accept_res.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_cannot_access_admin_endpoints(self):
        """Ordinary customers and workers are denied from all admin APIs."""
        self.client.force_authenticate(user=self.customer_a)
        res1 = self.client.get('/api/admin/bookings/')
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        res2 = self.client.get('/api/admin/incidents/')
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

        res3 = self.client.get(reverse('admin_audit_events_list'))
        self.assertEqual(res3.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.worker_user1)
        res4 = self.client.get(reverse('admin_worker_list'))
        self.assertEqual(res4.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 3. WORKER TRAVEL, ARRIVAL, NO-SHOW & REASSIGNMENT WORKFLOW
    # -------------------------------------------------------------------------

    def test_worker_travel_and_arrival_transitions(self):
        """Assigned worker can confirm travel, arrival, and report delay."""
        booking = Booking.objects.create(
            customer=self.customer_a,
            service=self.srv,
            service_address_line='124 Race Course Road',
            service_city='Coimbatore',
            service_pincode='641018',
            service_latitude=Decimal('11.006200'),
            service_longitude=Decimal('76.978500'),
            problem_description='Ceiling fan repair',
            status=BookingStatus.ASSIGNED,
            assigned_worker=self.worker1,
            assigned_at=timezone.now()
        )

        # 1. Worker confirms heading to job
        self.client.force_authenticate(user=self.worker_user1)
        heading_url = reverse('booking_worker_heading', kwargs={'pk': booking.id})
        res = self.client.post(heading_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.travel_status, WorkerTravelStatus.HEADING_TO_JOB)
        self.assertIsNotNone(booking.worker_heading_at)

        # 2. Worker reports delay
        delay_url = reverse('booking_worker_delay', kwargs={'pk': booking.id})
        delay_res = self.client.post(delay_url, {
            'reason': 'Traffic at Gandhipuram signal',
            'estimated_minutes': 20
        }, format='json')
        self.assertEqual(delay_res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.travel_status, WorkerTravelStatus.DELAYED)
        self.assertEqual(booking.estimated_arrival_minutes, 20)

        # 3. Worker confirms arrival
        arrive_url = reverse('booking_worker_arrive', kwargs={'pk': booking.id})
        arrive_res = self.client.post(arrive_url)
        self.assertEqual(arrive_res.status_code, status.HTTP_200_OK)
        booking.refresh_from_db()
        self.assertEqual(booking.travel_status, WorkerTravelStatus.ARRIVED)
        self.assertIsNotNone(booking.worker_arrived_at)

    def test_arrival_does_not_bypass_quotation_acceptance_invariant(self):
        """Work CANNOT begin even after arrival unless quotation has been accepted."""
        booking = Booking.objects.create(
            customer=self.customer_a,
            service=self.srv,
            service_address_line='124 Race Course Road',
            service_city='Coimbatore',
            service_pincode='641018',
            service_latitude=Decimal('11.006200'),
            service_longitude=Decimal('76.978500'),
            problem_description='Ceiling fan repair',
            status=BookingStatus.ASSIGNED,
            assigned_worker=self.worker1,
            travel_status=WorkerTravelStatus.ARRIVED,
            worker_arrived_at=timezone.now()
        )

        # Attempt to start work directly without quotation acceptance
        self.client.force_authenticate(user=self.worker_user1)
        start_res = self.client.post(reverse('booking_start_work', kwargs={'booking_id': booking.id}))
        self.assertEqual(start_res.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("accepted quotation", start_res.data['error'].lower())

    def test_customer_can_report_no_show_and_reassign(self):
        """Customer reports worker no-show and triggers atomic reassignment to another pro."""
        booking = Booking.objects.create(
            customer=self.customer_a,
            service=self.srv,
            service_address_line='124 Race Course Road',
            service_city='Coimbatore',
            service_pincode='641018',
            service_latitude=Decimal('11.006200'),
            service_longitude=Decimal('76.978500'),
            problem_description='Ceiling fan repair',
            status=BookingStatus.ASSIGNED,
            assigned_worker=self.worker1,
            travel_status=WorkerTravelStatus.HEADING_TO_JOB,
            worker_heading_at=timezone.now() - timedelta(minutes=60)
        )

        # 1. Customer reports no-show
        self.client.force_authenticate(user=self.customer_a)
        report_url = reverse('booking_report_no_show', kwargs={'pk': booking.id})
        rep_res = self.client.post(report_url, {
            'reason': 'Worker has not arrived after 1 hour and phone is unreachable'
        }, format='json')
        self.assertEqual(rep_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(NoShowReport.objects.filter(booking=booking, status=IncidentStatus.OPEN).exists())

        # 2. Customer triggers reassignment
        reassign_url = reverse('booking_reassign', kwargs={'pk': booking.id})
        reassign_res = self.client.post(reassign_url, {'reason': 'Reassign due to confirmed no-show'}, format='json')
        self.assertEqual(reassign_res.status_code, status.HTTP_200_OK)

        booking.refresh_from_db()
        # Previous worker released
        self.assertIsNone(booking.assigned_worker)
        self.assertEqual(booking.travel_status, WorkerTravelStatus.NOT_STARTED)
        self.assertEqual(booking.status, BookingStatus.SEARCHING)
        self.assertEqual(booking.dispatch_round, 2)

        # Incident updated to RESOLVED
        report = NoShowReport.objects.get(booking=booking)
        self.assertEqual(report.status, IncidentStatus.RESOLVED)

        # Fresh broadcast offer created for Worker 2 (excluding released Worker 1)
        self.assertTrue(WorkerOffer.objects.filter(booking=booking, worker=self.worker2, dispatch_round=2).exists())
        self.assertFalse(WorkerOffer.objects.filter(booking=booking, worker=self.worker1, dispatch_round=2).exists())
