from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView,
    LogoutView,
    CustomerRegisterView,
    WorkerRegisterView,
    UserProfileView,
    WorkerProfileManageView,
    WorkerAvailabilityToggleView,
    WorkerLocationUpdateView,
    AddressListCreateView,
    AddressDetailView,
    AdminWorkerListView,
    AdminWorkerApprovalActionView,
)

urlpatterns = [
    # Authentication
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='token_logout'),
    path('register/customer/', CustomerRegisterView.as_view(), name='register_customer'),
    path('register/worker/', WorkerRegisterView.as_view(), name='register_worker'),
    
    # User Profile
    path('profile/', UserProfileView.as_view(), name='user_profile'),

    # Worker Self-Management
    path('worker/profile/', WorkerProfileManageView.as_view(), name='worker_profile_manage'),
    path('worker/toggle-availability/', WorkerAvailabilityToggleView.as_view(), name='worker_toggle_availability'),
    path('worker/location/', WorkerLocationUpdateView.as_view(), name='worker_location_update'),

    # Customer Addresses
    path('customer/addresses/', AddressListCreateView.as_view(), name='address_list_create'),
    path('customer/addresses/<int:pk>/', AddressDetailView.as_view(), name='address_detail'),

    # Administrator Management
    path('admin/workers/', AdminWorkerListView.as_view(), name='admin_worker_list'),
    path('admin/workers/<int:worker_id>/approval/', AdminWorkerApprovalActionView.as_view(), name='admin_worker_approval'),
]
