from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.conf import settings
from decimal import Decimal

class UserRole(models.TextChoices):
    CUSTOMER = 'CUSTOMER', 'Customer'
    WORKER = 'WORKER', 'Worker'
    ADMIN = 'ADMIN', 'Admin'


class WorkerApprovalStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    SUSPENDED = 'SUSPENDED', 'Suspended'


class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.CUSTOMER,
        db_index=True,
        help_text='System role controlling access permissions'
    )
    phone_number = models.CharField(
        max_length=15,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text='Unique contact number'
    )
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        help_text='User profile avatar'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_customer(self):
        return self.role == UserRole.CUSTOMER

    def is_worker(self):
        return self.role == UserRole.WORKER

    def is_admin_role(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    def __str__(self):
        return f"{self.username} ({self.role})"


class WorkerProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='worker_profile'
    )
    approval_status = models.CharField(
        max_length=20,
        choices=WorkerApprovalStatus.choices,
        default=WorkerApprovalStatus.PENDING,
        db_index=True
    )
    approval_reason = models.TextField(
        blank=True,
        default='',
        help_text='Administrator comments regarding approval or rejection'
    )
    business_name = models.CharField(
        max_length=150,
        blank=True,
        default='',
        help_text='Trade or business title'
    )
    experience_years = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(0), MaxValueValidator(60)]
    )
    id_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text='Government ID number (Aadhaar / Voter ID / Driving License)'
    )
    id_document = models.FileField(
        upload_to='worker_docs/',
        null=True,
        blank=True,
        help_text='Document proof for admin verification'
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Current or home base latitude in Coimbatore'
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Current or home base longitude in Coimbatore'
    )
    service_radius_km = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        default=Decimal('5.0'),
        help_text='Maximum distance worker is willing to travel (default 5.0 km)'
    )
    is_available = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether the worker is currently open to receiving job broadcasts'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Operational active status'
    )
    last_location_updated_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text='Timestamp of last verified GPS location update'
    )
    is_location_sharing_enabled = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether the worker has enabled live location sharing'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_location_fresh(self) -> bool:
        """Returns True if the worker's coordinates were updated within the freshness threshold."""
        if not self.last_location_updated_at or self.latitude is None or self.longitude is None:
            return False
        from datetime import timedelta
        threshold_minutes = getattr(settings, 'WORKER_LOCATION_FRESHNESS_MINUTES', 60)
        cutoff = timezone.now() - timedelta(minutes=threshold_minutes)
        return self.last_location_updated_at >= cutoff

    @property
    def is_eligible_for_dispatch(self):
        """Worker must be approved, active, available, sharing location, and have fresh coordinates."""
        return (
            self.approval_status == WorkerApprovalStatus.APPROVED and
            self.is_active and
            self.is_available and
            self.is_location_sharing_enabled and
            self.is_location_fresh and
            self.user.is_active
        )

    def __str__(self):
        return f"WorkerProfile: {self.user.username} [{self.approval_status}]"


class Address(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='addresses'
    )
    title = models.CharField(
        max_length=60,
        default='Home',
        help_text='Label for address (e.g. Home, Office, Parents)'
    )
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True, default='')
    landmark = models.CharField(max_length=150, blank=True, default='')
    city = models.CharField(max_length=100, default='Coimbatore')
    pincode = models.CharField(max_length=10)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text='Latitude coordinates'
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text='Longitude coordinates'
    )
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Addresses'
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.title}: {self.address_line1}, {self.city} ({self.pincode})"
