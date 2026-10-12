import threading
from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.db import transaction, connection
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from apps.services.models import ServiceCategory, Service, WorkerService
from apps.bookings.models import Booking, BookingStatus, WorkerOffer, OfferStatus
from apps.bookings.services.dispatch import (
    create_booking_and_dispatch,
    accept_worker_offer,
    reject_worker_offer,
    expire_stale_offers,
    retry_booking_dispatch,
)
from apps.bookings.services.booking_lifecycle import cancel_booking_by_customer
from apps.quotations.models import Quotation, QuotationStatus
from apps.quotations.services.quotation_service import (
    create_or_revise_quotation,
    accept_quotation,
    decline_quotation,
    start_work_on_booking,
    complete_work_on_booking,
)
from apps.notifications.models import Notification, NotificationType, AuditEvent, AuditEventType
from apps.notifications.services import create_notification, record_audit_event, sanitize_metadata


class NotificationAPITestCase(TestCase):
    """
    Tests for Notification APIs: listing, unread count, mark-read, mark-all-read,
    pagination, unread filtering, and strict user privacy boundaries.
    """
    def setUp(self):
        self.customer_user = User.objects.create_user(
            username='cust_notif_test',
            phone_number='+919876543210',
            password='TestPassword123!',
            role=UserRole.CUSTOMER
        )
        self.other_user = User.objects.create_user(
            username='other_notif_test',
            phone_number='+919876543211',
            password='TestPassword123!',
            role=UserRole.CUSTOMER
        )

        self.client_auth = APIClient()
        self.client_auth.force_authenticate(user=self.customer_user)

        self.client_other = APIClient()
        self.client_other.force_authenticate(user=self.other_user)

        self.client_anon = APIClient()

        # Seed notifications for customer_user
        self.notif1 = Notification.objects.create(
            recipient=self.customer_user,
            notification_type=NotificationType.WORKER_ASSIGNED,
            title="Service Professional Assigned",
            message="Worker assigned to your booking.",
            is_read=False
        )
        self.notif2 = Notification.objects.create(
            recipient=self.customer_user,
            notification_type=NotificationType.QUOTATION_SUBMITTED,
            title="Quotation Received",
            message="Quotation submitted for review.",
            is_read=False
        )
        self.notif_read = Notification.objects.create(
            recipient=self.customer_user,
            notification_type=NotificationType.WORK_STARTED,
            title="Work Started",
            message="Work has started.",
            is_read=True
        )

        # Seed notification for other_user
        self.other_notif = Notification.objects.create(
            recipient=self.other_user,
            notification_type=NotificationType.NEW_OFFER,
            title="Private Job Offer",
            message="Secret offer for other user.",
            is_read=False
        )

    def test_unauthenticated_cannot_access_notifications(self):
        url = reverse('notification_list')
        resp = self.client_anon.get(url)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_can_list_own_notifications(self):
        url = reverse('notification_list')
        resp = self.client_auth.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Standard DRF pagination response contains 'results'
        results = resp.data.get('results', resp.data)
        ids = [item['id'] for item in results]
        self.assertIn(str(self.notif1.id), ids)
        self.assertIn(str(self.notif2.id), ids)
        self.assertIn(str(self.notif_read.id), ids)
        # Must NOT include other user's notification
        self.assertNotIn(str(self.other_notif.id), ids)

    def test_unread_filtering(self):
        url = reverse('notification_list') + '?unread=true'
        resp = self.client_auth.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get('results', resp.data)
        for item in results:
            self.assertFalse(item['is_read'])
        self.assertEqual(len(results), 2)

    def test_unread_count_accurate(self):
        url = reverse('notification_unread_count')
        resp = self.client_auth.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['unread_count'], 2)

    def test_mark_notification_as_read(self):
        url = reverse('notification_mark_read', kwargs={'pk': self.notif1.id})
        resp = self.client_auth.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['notification']['is_read'])
        self.assertIsNotNone(resp.data['notification']['read_at'])

        self.notif1.refresh_from_db()
        self.assertTrue(self.notif1.is_read)
        self.assertIsNotNone(self.notif1.read_at)

    def test_repeated_mark_as_read_is_idempotent(self):
        url = reverse('notification_mark_read', kwargs={'pk': self.notif1.id})
        resp1 = self.client_auth.post(url)
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        self.notif1.refresh_from_db()
        first_read_at = self.notif1.read_at

        # Repeat the call
        resp2 = self.client_auth.post(url)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.notif1.refresh_from_db()
        # read_at timestamp remains unchanged
        self.assertEqual(self.notif1.read_at, first_read_at)

    def test_user_cannot_read_or_mark_other_users_notification(self):
        # Attempt to mark other user's notification as read
        url = reverse('notification_mark_read', kwargs={'pk': self.other_notif.id})
        resp = self.client_auth.post(url)
        # Must return privacy-safe 404
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

        # Other user's notification is untouched
        self.other_notif.refresh_from_db()
        self.assertFalse(self.other_notif.is_read)

    def test_mark_all_read_affects_only_current_user(self):
        url = reverse('notification_mark_all_read')
        resp = self.client_auth.post(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['updated_count'], 2)

        # Customer's unread count is now 0
        self.assertEqual(Notification.objects.filter(recipient=self.customer_user, is_read=False).count(), 0)

        # Other user's notification is STILL unread
        self.other_notif.refresh_from_db()
        self.assertFalse(self.other_notif.is_read)


class NotificationTriggersIntegrationTestCase(TestCase):
    """
    Tests that booking, quotation, and work-lifecycle business services
    trigger appropriate in-app notifications and audit events.
    """
    def setUp(self):
        # Category and Service
        self.category = ServiceCategory.objects.create(name='Plumbing Test', slug='plumbing-test')
        self.service = Service.objects.create(
            category=self.category,
            name='Pipe Leak Repair',
            is_active=True
        )

        # Customer
        self.customer = User.objects.create_user(
            username='cust_trig_test',
            phone_number='+919111111111',
            password='TestPassword123!',
            role=UserRole.CUSTOMER
        )
        self.address = Address.objects.create(
            user=self.customer,
            title='Home',
            address_line1='123 Gandhipuram',
            city='Coimbatore',
            pincode='641012',
            latitude=Decimal('11.0168'),
            longitude=Decimal('76.9558')
        )

        # Eligible Worker
        self.worker_user = User.objects.create_user(
            username='wkr_trig_test',
            phone_number='+919222222222',
            password='TestPassword123!',
            role=UserRole.WORKER
        )
        self.worker_profile = WorkerProfile.objects.create(
            user=self.worker_user,
            business_name='Gandhipuram Plumbers',
            approval_status=WorkerApprovalStatus.APPROVED,
            is_active=True,
            is_available=True,
            latitude=Decimal('11.0170'),
            longitude=Decimal('76.9560'),
            service_radius_km=Decimal('5.0')
        )
        WorkerService.objects.create(
            worker=self.worker_profile,
            service=self.service,
            is_active=True
        )

    def test_booking_dispatch_notifies_eligible_worker(self):
        booking, count = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.address,
            problem_description="Leaking pipe under kitchen sink."
        )
        self.assertEqual(count, 1)

        # Worker received NEW_OFFER notification
        notif = Notification.objects.filter(
            recipient=self.worker_user,
            notification_type=NotificationType.NEW_OFFER,
            related_booking=booking
        ).first()
        self.assertIsNotNone(notif)
        self.assertIn("Pipe Leak Repair", notif.message)

        # Audit events recorded
        self.assertTrue(AuditEvent.objects.filter(event_type=AuditEventType.BOOKING_CREATED, related_booking=booking).exists())
        self.assertTrue(AuditEvent.objects.filter(event_type=AuditEventType.OFFERS_DISPATCHED, related_booking=booking).exists())

    def test_winning_assignment_notifies_winner_and_customer(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.address,
            problem_description="Leaking pipe"
        )
        offer = WorkerOffer.objects.get(booking=booking, worker=self.worker_profile)

        accept_worker_offer(offer.id, self.worker_profile)

        # Winner notified
        w_notif = Notification.objects.filter(
            recipient=self.worker_user,
            notification_type=NotificationType.OFFER_ACCEPTED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(w_notif)

        # Customer notified
        c_notif = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.WORKER_ASSIGNED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(c_notif)

        # Audit event recorded
        self.assertTrue(AuditEvent.objects.filter(event_type=AuditEventType.WORKER_ACCEPTED, related_booking=booking).exists())

    def test_no_workers_available_notifies_customer(self):
        # Create address far away with no workers
        far_address = Address.objects.create(
            user=self.customer,
            title='Far House',
            address_line1='Far Outskirt',
            city='Coimbatore',
            pincode='641032',
            latitude=Decimal('10.8500'),
            longitude=Decimal('76.9000')
        )
        booking, count = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=far_address,
            problem_description="Remote pipe leak",
            search_radius_km=1.0
        )
        self.assertEqual(count, 0)
        self.assertEqual(booking.status, BookingStatus.EXPIRED)

        # Customer notified of NO_WORKERS
        notif = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.NO_WORKERS,
            related_booking=booking
        ).first()
        self.assertIsNotNone(notif)

    def test_quotation_submission_and_revision_notify_customer(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.address,
            problem_description="Leaking pipe"
        )
        offer = WorkerOffer.objects.get(booking=booking, worker=self.worker_profile)
        booking = accept_worker_offer(offer.id, self.worker_profile)

        # First quote submission
        quote1 = create_or_revise_quotation(
            booking=booking,
            worker=self.worker_profile,
            work_description="Replace PVC pipe",
            labor_charge=Decimal('300.00'),
            materials_charge=Decimal('150.00')
        )
        notif1 = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.QUOTATION_SUBMITTED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(notif1)
        self.assertIn("450.00", notif1.message)

        # Quotation revision
        quote2 = create_or_revise_quotation(
            booking=booking,
            worker=self.worker_profile,
            work_description="Replace PVC pipe with premium brand",
            labor_charge=Decimal('300.00'),
            materials_charge=Decimal('250.00')
        )
        notif2 = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.QUOTATION_REVISED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(notif2)
        self.assertIn("550.00", notif2.message)

        # Audit events recorded
        self.assertTrue(AuditEvent.objects.filter(event_type=AuditEventType.QUOTATION_SUBMITTED, related_booking=booking).exists())
        self.assertTrue(AuditEvent.objects.filter(event_type=AuditEventType.QUOTATION_REVISED, related_booking=booking).exists())

    def test_quotation_acceptance_and_decline_notify_worker(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.address,
            problem_description="Leaking pipe"
        )
        offer = WorkerOffer.objects.get(booking=booking, worker=self.worker_profile)
        booking = accept_worker_offer(offer.id, self.worker_profile)

        quote = create_or_revise_quotation(
            booking=booking,
            worker=self.worker_profile,
            work_description="Fix leak",
            labor_charge=Decimal('300.00')
        )

        # Decline quotation
        decline_quotation(booking.id, quote.id, self.customer, reason="Too high")
        d_notif = Notification.objects.filter(
            recipient=self.worker_user,
            notification_type=NotificationType.QUOTATION_DECLINED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(d_notif)

        # Worker submits adjusted quote
        quote2 = create_or_revise_quotation(
            booking=booking,
            worker=self.worker_profile,
            work_description="Discounted fix",
            labor_charge=Decimal('200.00')
        )

        # Customer accepts
        accept_quotation(booking.id, quote2.id, self.customer)
        a_notif = Notification.objects.filter(
            recipient=self.worker_user,
            notification_type=NotificationType.QUOTATION_ACCEPTED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(a_notif)
        self.assertIn("200.00", a_notif.message)

    def test_work_start_and_completion_notify_customer(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.address,
            problem_description="Leaking pipe"
        )
        offer = WorkerOffer.objects.get(booking=booking, worker=self.worker_profile)
        booking = accept_worker_offer(offer.id, self.worker_profile)

        quote = create_or_revise_quotation(
            booking=booking,
            worker=self.worker_profile,
            work_description="Fix leak",
            labor_charge=Decimal('200.00')
        )
        accept_quotation(booking.id, quote.id, self.customer)

        # Start work
        start_work_on_booking(booking.id, self.worker_profile)
        s_notif = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.WORK_STARTED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(s_notif)

        # Complete work
        complete_work_on_booking(booking.id, self.worker_profile)
        c_notif = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.WORK_COMPLETED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(c_notif)

    def test_booking_cancellation_notifies_customer(self):
        booking, _ = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.address,
            problem_description="Leaking pipe"
        )
        cancel_booking_by_customer(booking.id, self.customer, reason="Not needed anymore")
        c_notif = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.BOOKING_CANCELLED,
            related_booking=booking
        ).first()
        self.assertIsNotNone(c_notif)

    def test_notification_idempotency_prevents_duplicates(self):
        # Create notification with specific idempotency key
        n1 = create_notification(
            recipient=self.customer,
            notification_type=NotificationType.NO_WORKERS,
            title="Test Alert",
            message="Test message",
            idempotency_key="unique_alert_key_123"
        )
        # Attempt to create duplicate with identical key
        n2 = create_notification(
            recipient=self.customer,
            notification_type=NotificationType.NO_WORKERS,
            title="Test Alert Duplicate",
            message="Test message duplicate",
            idempotency_key="unique_alert_key_123"
        )
        self.assertEqual(n1.id, n2.id)
        self.assertEqual(Notification.objects.filter(idempotency_key="unique_alert_key_123").count(), 1)


class AuditTrailTestCase(TestCase):
    """
    Tests that audit events capture authentic state transitions,
    sanitize sensitive data, and restrict access strictly to administrators.
    """
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username='admin_audit_test',
            phone_number='+919999900000',
            password='AdminPassword123!',
            role=UserRole.ADMIN
        )
        self.customer_user = User.objects.create_user(
            username='cust_audit_test',
            phone_number='+919999911111',
            password='CustPassword123!',
            role=UserRole.CUSTOMER
        )

        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin_user)

        self.client_cust = APIClient()
        self.client_cust.force_authenticate(user=self.customer_user)

    def test_sanitize_metadata_strips_sensitive_information(self):
        raw_meta = {
            'password': 'SuperSecretPassword!',
            'token': 'jwt.token.string',
            'access': 'bearer_token',
            'address_line1': 'Flat 4B, Confidential Towers',
            'id_document': 'Passport_Scan.jpg',
            'worker_id': 12,
            'amount': Decimal('500.00'),
            'service_name': 'Plumbing'
        }
        clean_meta = sanitize_metadata(raw_meta)
        self.assertNotIn('password', clean_meta)
        self.assertNotIn('token', clean_meta)
        self.assertNotIn('access', clean_meta)
        self.assertNotIn('address_line1', clean_meta)
        self.assertNotIn('id_document', clean_meta)
        self.assertEqual(clean_meta['worker_id'], 12)
        self.assertEqual(clean_meta['service_name'], 'Plumbing')
        self.assertEqual(clean_meta['amount'], '500.00')

    def test_admin_can_list_and_filter_audit_events(self):
        event1 = record_audit_event(
            event_type=AuditEventType.BOOKING_CREATED,
            actor=self.customer_user,
            metadata={'service_id': 1}
        )
        event2 = record_audit_event(
            event_type=AuditEventType.QUOTATION_ACCEPTED,
            actor=self.customer_user,
            metadata={'amount': '450.00'}
        )

        url = reverse('admin_audit_events_list')
        resp = self.client_admin.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get('results', resp.data)
        ids = [item['id'] for item in results]
        self.assertIn(str(event1.id), ids)
        self.assertIn(str(event2.id), ids)

        # Filter by event_type
        filter_url = reverse('admin_audit_events_list') + f'?event_type={AuditEventType.BOOKING_CREATED}'
        f_resp = self.client_admin.get(filter_url)
        f_results = f_resp.data.get('results', f_resp.data)
        self.assertEqual(len(f_results), 1)
        self.assertEqual(f_results[0]['id'], str(event1.id))

    def test_ordinary_users_cannot_access_or_modify_audit_events(self):
        url = reverse('admin_audit_events_list')
        resp = self.client_cust.get(url)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # No POST/PUT/DELETE allowed on audit endpoints
        resp_post = self.client_cust.post(url, {'event_type': 'FAKE'})
        self.assertEqual(resp_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_failed_transactions_do_not_persist_notifications_or_audit(self):
        initial_notif_count = Notification.objects.count()
        initial_audit_count = AuditEvent.objects.count()

        try:
            with transaction.atomic():
                record_audit_event(
                    event_type=AuditEventType.BOOKING_CREATED,
                    actor=self.customer_user
                )
                create_notification(
                    recipient=self.customer_user,
                    notification_type=NotificationType.WORKER_ASSIGNED,
                    title="Will Roll Back",
                    message="Should not persist"
                )
                raise RuntimeError("Simulated transaction failure")
        except RuntimeError:
            pass

        # Database state rolled back completely
        self.assertEqual(Notification.objects.count(), initial_notif_count)
        self.assertEqual(AuditEvent.objects.count(), initial_audit_count)


class ConcurrentAcceptanceNotificationTestCase(TransactionTestCase):
    """
    PostgreSQL concurrency test ensuring that racing worker acceptances
    produce exactly one winner notification and one customer notification,
    with zero contradictory notifications.
    """
    def setUp(self):
        self.category = ServiceCategory.objects.create(name='Race Plumbing', slug='race-plumbing')
        self.service = Service.objects.create(
            category=self.category,
            name='Emergency Pipe Fix',
            is_active=True
        )
        self.customer = User.objects.create_user(
            username='cust_race_notif',
            phone_number='+919000000001',
            password='TestPassword123!',
            role=UserRole.CUSTOMER
        )
        self.address = Address.objects.create(
            user=self.customer,
            title='Race Location',
            address_line1='Gandhipuram Cross',
            city='Coimbatore',
            pincode='641012',
            latitude=Decimal('11.0168'),
            longitude=Decimal('76.9558')
        )

        # Worker A
        self.workerA_user = User.objects.create_user(
            username='wkrA_race_notif',
            phone_number='+919000000002',
            password='TestPassword123!',
            role=UserRole.WORKER
        )
        self.workerA_profile = WorkerProfile.objects.create(
            user=self.workerA_user,
            business_name='A Services',
            approval_status=WorkerApprovalStatus.APPROVED,
            is_active=True,
            is_available=True,
            latitude=Decimal('11.0170'),
            longitude=Decimal('76.9560'),
            service_radius_km=Decimal('5.0')
        )
        WorkerService.objects.create(worker=self.workerA_profile, service=self.service, is_active=True)

        # Worker B
        self.workerB_user = User.objects.create_user(
            username='wkrB_race_notif',
            phone_number='+919000000003',
            password='TestPassword123!',
            role=UserRole.WORKER
        )
        self.workerB_profile = WorkerProfile.objects.create(
            user=self.workerB_user,
            business_name='B Services',
            approval_status=WorkerApprovalStatus.APPROVED,
            is_active=True,
            is_available=True,
            latitude=Decimal('11.0172'),
            longitude=Decimal('76.9562'),
            service_radius_km=Decimal('5.0')
        )
        WorkerService.objects.create(worker=self.workerB_profile, service=self.service, is_active=True)

    def test_concurrent_worker_acceptance_creates_exact_notifications(self):
        booking, count = create_booking_and_dispatch(
            customer=self.customer,
            service=self.service,
            address=self.address,
            problem_description="Concurrent pipe burst"
        )
        self.assertEqual(count, 2)

        offerA = WorkerOffer.objects.get(booking=booking, worker=self.workerA_profile)
        offerB = WorkerOffer.objects.get(booking=booking, worker=self.workerB_profile)

        results = {}

        def accept_worker(worker_label, offer_id, profile):
            connection.close()
            try:
                accept_worker_offer(offer_id, profile)
                results[worker_label] = "SUCCESS"
            except Exception as e:
                results[worker_label] = f"CONFLICT: {type(e).__name__}"
            finally:
                connection.close()

        t1 = threading.Thread(target=accept_worker, args=("WorkerA", offerA.id, self.workerA_profile))
        t2 = threading.Thread(target=accept_worker, args=("WorkerB", offerB.id, self.workerB_profile))

        t1.start()
        t2.start()

        t1.join()
        t2.join()

        # Exactly one succeeded and one conflicted
        statuses = list(results.values())
        self.assertEqual(statuses.count("SUCCESS"), 1)
        self.assertEqual(sum(1 for s in statuses if s.startswith("CONFLICT")), 1)

        # Verify notification counts
        # 1. Exactly ONE OFFER_ACCEPTED notification across all workers
        winner_notifs = Notification.objects.filter(
            notification_type=NotificationType.OFFER_ACCEPTED,
            related_booking=booking
        )
        self.assertEqual(winner_notifs.count(), 1)

        # 2. Exactly ONE WORKER_ASSIGNED notification for the customer
        cust_notifs = Notification.objects.filter(
            recipient=self.customer,
            notification_type=NotificationType.WORKER_ASSIGNED,
            related_booking=booking
        )
        self.assertEqual(cust_notifs.count(), 1)
