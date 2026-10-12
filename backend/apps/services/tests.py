from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from django.core.management import call_command
import io

from apps.accounts.models import User, UserRole, WorkerProfile, WorkerApprovalStatus
from apps.services.models import ServiceCategory, Service, WorkerService, PricingModel


class ServiceCatalogTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin_user = User.objects.create_superuser(
            username="admin_test",
            email="admin@test.com",
            password="AdminPassword123!",
            role=UserRole.ADMIN
        )

        # Customer user
        self.customer_user = User.objects.create_user(
            username="customer_test",
            email="customer@test.com",
            password="CustomerPassword123!",
            role=UserRole.CUSTOMER
        )

        # Approved Worker
        self.worker_user = User.objects.create_user(
            username="approved_worker",
            email="worker@test.com",
            password="WorkerPassword123!",
            role=UserRole.WORKER
        )
        self.worker_profile = WorkerProfile.objects.create(
            user=self.worker_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            business_name="Pro Plumbing",
            experience_years=5,
            is_available=True,
            is_active=True
        )

        # Pending Worker
        self.pending_worker_user = User.objects.create_user(
            username="pending_worker",
            email="pending@test.com",
            password="WorkerPassword123!",
            role=UserRole.WORKER
        )
        self.pending_worker_profile = WorkerProfile.objects.create(
            user=self.pending_worker_user,
            approval_status=WorkerApprovalStatus.PENDING,
            business_name="Newbie Plumbing",
            experience_years=1,
            is_available=True,
            is_active=True
        )

        # Pre-seed sample category & services
        self.category_plumbing = ServiceCategory.objects.create(
            name="Plumbing",
            slug="plumbing",
            description="Plumbing services",
            icon="wrench",
            is_active=True
        )
        self.service_tap = Service.objects.create(
            category=self.category_plumbing,
            name="Tap and faucet repair",
            slug="tap-and-faucet-repair",
            description="Fixing leaking taps",
            is_active=True
        )
        self.service_inactive = Service.objects.create(
            category=self.category_plumbing,
            name="Obsolete Pipe Service",
            slug="obsolete-pipe-service",
            description="Inactive service",
            is_active=False
        )
        self.category_inactive = ServiceCategory.objects.create(
            name="Decommissioned Category",
            slug="decommissioned-category",
            description="Inactive category",
            is_active=False
        )
        self.service_in_inactive_cat = Service.objects.create(
            category=self.category_inactive,
            name="Service in Inactive Category",
            slug="service-in-inactive-category",
            is_active=True
        )

    # 1. Administrator can create a category.
    def test_admin_can_create_category(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_category_list_create')
        data = {
            "name": "Carpentry & Woodwork",
            "slug": "carpentry-woodwork",
            "description": "Furniture repairs and door installation",
            "icon": "hammer"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ServiceCategory.objects.filter(slug="carpentry-woodwork").exists())

    # 2. Non-administrator cannot create or modify categories.
    def test_non_admin_cannot_create_or_modify_category(self):
        # Customer attempt
        self.client.force_authenticate(user=self.customer_user)
        url = reverse('admin_category_list_create')
        res1 = self.client.post(url, {"name": "Hacked Category", "slug": "hacked"}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # Worker attempt
        self.client.force_authenticate(user=self.worker_user)
        res2 = self.client.post(url, {"name": "Worker Category", "slug": "worker-cat"}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

        # Anonymous attempt
        self.client.logout()
        res3 = self.client.post(url, {"name": "Anon Category", "slug": "anon-cat"}, format='json')
        self.assertEqual(res3.status_code, status.HTTP_401_UNAUTHORIZED)

    # 3. Administrator can create and deactivate services.
    def test_admin_can_create_and_deactivate_service(self):
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('admin_catalog_list_create')
        data = {
            "category": self.category_plumbing.id,
            "name": "Emergency Pipe Burst",
            "slug": "emergency-pipe-burst",
            "description": "24/7 urgent pipe welding",
            "is_active": True
        }
        create_res = self.client.post(url, data, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        service_id = create_res.data['id']

        # Deactivate
        detail_url = reverse('admin_catalog_detail', kwargs={'pk': service_id})
        patch_res = self.client.patch(detail_url, {"is_active": False}, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertFalse(patch_res.data['is_active'])
        self.assertFalse(Service.objects.get(id=service_id).is_active)

    # 4. Public users can see active catalog entries.
    def test_public_user_can_see_active_catalog(self):
        self.client.logout()
        url = reverse('service_catalog_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should include active service
        slugs = [item['slug'] for item in response.data['results'] if 'results' in response.data] or [item['slug'] for item in response.data]
        self.assertIn(self.service_tap.slug, slugs)

    # 5. Inactive services do not appear in public results.
    def test_inactive_services_do_not_appear_in_public_results(self):
        self.client.logout()
        url = reverse('service_catalog_list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.data.get('results', response.data)
        slugs = [item['slug'] for item in items]
        self.assertNotIn(self.service_inactive.slug, slugs)
        self.assertNotIn(self.service_in_inactive_cat.slug, slugs)

    # 6. Worker can create an offering for an active service.
    def test_approved_worker_can_create_offering_for_active_service(self):
        self.client.force_authenticate(user=self.worker_user)
        url = reverse('worker_services_list_create')
        data = {
            "service_id": self.service_tap.id,
            "experience_years": 4,
            "pricing_model": PricingModel.QUOTATION_BASED,
            "inspection_fee": "150.00"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(WorkerService.objects.filter(worker=self.worker_profile, service=self.service_tap).exists())
        ws = WorkerService.objects.get(worker=self.worker_profile, service=self.service_tap)
        self.assertEqual(ws.inspection_fee, Decimal('150.00'))

    # 7. Pending worker cannot perform restricted operational actions.
    def test_pending_worker_cannot_create_offering(self):
        self.client.force_authenticate(user=self.pending_worker_user)
        url = reverse('worker_services_list_create')
        data = {
            "service_id": self.service_tap.id,
            "experience_years": 1,
            "inspection_fee": "100.00"
        }
        response = self.client.post(url, data, format='json')
        # Only approved workers can perform restricted actions
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 8. Worker cannot edit another worker's offering.
    def test_worker_cannot_edit_another_worker_offering(self):
        # Worker 1 offering
        ws1 = WorkerService.objects.create(
            worker=self.worker_profile,
            service=self.service_tap,
            experience_years=5,
            inspection_fee=Decimal('200.00')
        )

        # Worker 2 (Approved)
        other_worker_user = User.objects.create_user(
            username="other_worker",
            email="other@test.com",
            password="OtherPassword123!",
            role=UserRole.WORKER
        )
        other_profile = WorkerProfile.objects.create(
            user=other_worker_user,
            approval_status=WorkerApprovalStatus.APPROVED,
            business_name="Other Plumbing",
            is_available=True,
            is_active=True
        )

        # Worker 2 tries to PATCH worker 1's offering
        self.client.force_authenticate(user=other_worker_user)
        url = reverse('worker_services_detail', kwargs={'pk': ws1.id})
        response = self.client.patch(url, {"inspection_fee": "50.00"}, format='json')
        # Expect 404 (not in their queryset) or 403 Forbidden
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
        ws1.refresh_from_db()
        self.assertEqual(ws1.inspection_fee, Decimal('200.00'))

    # 9. Duplicate worker-service offerings are rejected.
    def test_duplicate_worker_service_offering_rejected(self):
        WorkerService.objects.create(
            worker=self.worker_profile,
            service=self.service_tap,
            experience_years=3
        )
        self.client.force_authenticate(user=self.worker_user)
        url = reverse('worker_services_list_create')
        data = {
            "service_id": self.service_tap.id,
            "experience_years": 5
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already added", str(response.data))

    # 10. Invalid or negative experience values are rejected.
    def test_invalid_experience_values_rejected(self):
        self.client.force_authenticate(user=self.worker_user)
        url = reverse('worker_services_list_create')
        
        # Negative experience
        res_neg = self.client.post(url, {
            "service_id": self.service_tap.id,
            "experience_years": -3
        }, format='json')
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

        # Absurd experience (>60)
        res_high = self.client.post(url, {
            "service_id": self.service_tap.id,
            "experience_years": 99
        }, format='json')
        self.assertEqual(res_high.status_code, status.HTTP_400_BAD_REQUEST)

    # 11. Invalid inspection fees are rejected.
    def test_invalid_inspection_fee_rejected(self):
        self.client.force_authenticate(user=self.worker_user)
        url = reverse('worker_services_list_create')
        res_neg_fee = self.client.post(url, {
            "service_id": self.service_tap.id,
            "inspection_fee": "-50.00"
        }, format='json')
        self.assertEqual(res_neg_fee.status_code, status.HTTP_400_BAD_REQUEST)

    # 12. Inactive categories cannot receive new worker offerings.
    def test_inactive_categories_cannot_receive_worker_offerings(self):
        self.client.force_authenticate(user=self.worker_user)
        url = reverse('worker_services_list_create')
        # service_in_inactive_cat belongs to inactive category
        res = self.client.post(url, {
            "service_id": self.service_in_inactive_cat.id,
            "experience_years": 2
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive category", str(res.data))

        # Also inactive service directly
        res_inactive_svc = self.client.post(url, {
            "service_id": self.service_inactive.id,
            "experience_years": 2
        }, format='json')
        self.assertEqual(res_inactive_svc.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("inactive service", str(res_inactive_svc.data))

    # 13. Catalog filters return the expected records.
    def test_catalog_filter_by_category_and_search(self):
        self.client.logout()
        # Filter by category
        url_cat = f"{reverse('service_catalog_list')}?category={self.category_plumbing.slug}"
        res_cat = self.client.get(url_cat)
        self.assertEqual(res_cat.status_code, status.HTTP_200_OK)
        items = res_cat.data.get('results', res_cat.data)
        self.assertTrue(all(item['category_slug'] == 'plumbing' for item in items))

        # Filter by search
        url_search = f"{reverse('service_catalog_list')}?search=faucet"
        res_search = self.client.get(url_search)
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        items_search = res_search.data.get('results', res_search.data)
        self.assertTrue(any('faucet' in item['name'].lower() for item in items_search))

    # 14. Seed command can be run repeatedly without duplicates.
    def test_seed_command_idempotence(self):
        out = io.StringIO()
        call_command('seed_service_catalog', stdout=out)
        output1 = out.getvalue()
        self.assertIn("Successfully processed catalog", output1)

        cat_count_1 = ServiceCategory.objects.count()
        svc_count_1 = Service.objects.count()

        # Run second time
        out2 = io.StringIO()
        call_command('seed_service_catalog', stdout=out2)
        cat_count_2 = ServiceCategory.objects.count()
        svc_count_2 = Service.objects.count()

        self.assertEqual(cat_count_1, cat_count_2)
        self.assertEqual(svc_count_1, svc_count_2)
