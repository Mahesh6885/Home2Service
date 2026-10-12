from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from decimal import Decimal

class AccountsAuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer_data = {
            "username": "kavitha",
            "email": "kavitha@example.com",
            "phone_number": "9876543210",
            "password": "SecurePassword123!",
            "password_confirm": "SecurePassword123!",
            "first_name": "Kavitha",
            "last_name": "Raman"
        }
        self.worker_data = {
            "username": "senthil_plumber",
            "email": "senthil@example.com",
            "phone_number": "9876543211",
            "password": "WorkerPassword123!",
            "password_confirm": "WorkerPassword123!",
            "first_name": "Senthil",
            "last_name": "Kumar",
            "business_name": "Senthil Plumbing Solutions",
            "experience_years": 8,
            "id_number": "AADHAAR12345678",
            "latitude": "11.016844",
            "longitude": "76.955832"
        }

    def test_customer_registration_success(self):
        url = reverse('register_customer')
        response = self.client.post(url, self.customer_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="kavitha").exists())
        user = User.objects.get(username="kavitha")
        self.assertEqual(user.role, UserRole.CUSTOMER)
        self.assertFalse(hasattr(user, 'worker_profile'))

    def test_worker_registration_creates_pending_profile(self):
        url = reverse('register_worker')
        response = self.client.post(url, self.worker_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="senthil_plumber")
        self.assertEqual(user.role, UserRole.WORKER)
        self.assertTrue(hasattr(user, 'worker_profile'))
        profile = user.worker_profile
        self.assertEqual(profile.approval_status, WorkerApprovalStatus.PENDING)
        self.assertFalse(profile.is_eligible_for_dispatch)
        self.assertEqual(profile.experience_years, 8)

    def test_jwt_login_returns_user_metadata_and_role(self):
        # Register customer
        self.client.post(reverse('register_customer'), self.customer_data, format='json')
        
        login_url = reverse('token_obtain_pair')
        login_data = {
            "username": "kavitha",
            "password": "SecurePassword123!"
        }
        response = self.client.post(login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['role'], UserRole.CUSTOMER)

    def test_worker_cannot_toggle_availability_before_admin_approval(self):
        # Register worker
        self.client.post(reverse('register_worker'), self.worker_data, format='json')
        worker = User.objects.get(username="senthil_plumber")
        
        self.client.force_authenticate(user=worker)
        toggle_url = reverse('worker_toggle_availability')
        response = self.client.post(toggle_url, {"is_available": True}, format='json')
        
        # Must be rejected because approval_status is PENDING
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Only approved workers can toggle availability", response.data['error'])

    def test_admin_can_approve_worker_and_enable_dispatch(self):
        # Register worker
        self.client.post(reverse('register_worker'), self.worker_data, format='json')
        worker = User.objects.get(username="senthil_plumber")
        profile = worker.worker_profile

        # Create admin
        admin_user = User.objects.create_superuser(
            username="admin_user",
            email="admin@test.com",
            password="AdminPassword123!",
            role=UserRole.ADMIN
        )

        self.client.force_authenticate(user=admin_user)
        approve_url = reverse('admin_worker_approval', kwargs={'worker_id': profile.id})
        response = self.client.post(approve_url, {
            "approval_status": WorkerApprovalStatus.APPROVED,
            "approval_reason": "Verified government Aadhaar card documents."
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.approval_status, WorkerApprovalStatus.APPROVED)
        self.assertTrue(profile.is_eligible_for_dispatch)

        # Now worker should be able to toggle availability
        self.client.force_authenticate(user=worker)
        toggle_res = self.client.post(reverse('worker_toggle_availability'), {"is_available": False}, format='json')
        self.assertEqual(toggle_res.status_code, status.HTTP_200_OK)
        self.assertFalse(toggle_res.data['is_available'])

    def test_non_admin_cannot_access_admin_endpoints(self):
        # Register customer
        self.client.post(reverse('register_customer'), self.customer_data, format='json')
        customer = User.objects.get(username="kavitha")
        
        self.client.force_authenticate(user=customer)
        admin_url = reverse('admin_worker_list')
        response = self.client.get(admin_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_address_validation_for_coimbatore_coordinates(self):
        # Register customer
        self.client.post(reverse('register_customer'), self.customer_data, format='json')
        customer = User.objects.get(username="kavitha")
        self.client.force_authenticate(user=customer)

        addr_url = reverse('address_list_create')
        # Valid Coimbatore address (RS Puram)
        valid_addr = {
            "title": "Home",
            "address_line1": "12, West Sambandam Road, RS Puram",
            "landmark": "Near DB Road",
            "city": "Coimbatore",
            "pincode": "641002",
            "latitude": "11.008922",
            "longitude": "76.948215",
            "is_default": True
        }
        res_valid = self.client.post(addr_url, valid_addr, format='json')
        self.assertEqual(res_valid.status_code, status.HTTP_201_CREATED)

        # Invalid coordinate (Chennai coordinate ~ 13.08, 80.27)
        invalid_addr = {
            "title": "Chennai Office",
            "address_line1": "Mount Road",
            "city": "Chennai",
            "pincode": "600002",
            "latitude": "13.082700",
            "longitude": "80.270700"
        }
        res_invalid = self.client.post(addr_url, invalid_addr, format='json')
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("latitude", res_invalid.data)
