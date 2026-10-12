from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils.text import slugify
from decimal import Decimal

class ServiceCategory(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,
        help_text='Unique name for the service category (e.g. Plumbing, Electrical)'
    )
    slug = models.SlugField(
        max_length=120,
        unique=True,
        db_index=True,
        help_text='URL-friendly identifier'
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text='Description of services in this category'
    )
    icon = models.CharField(
        max_length=60,
        blank=True,
        default='wrench',
        help_text='Icon identifier for the category'
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether this category is visible and active on the platform'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Service Categories'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Service(models.Model):
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.PROTECT,
        related_name='services',
        help_text='Parent category'
    )
    name = models.CharField(
        max_length=150,
        help_text='Specific service name (e.g. Tap and Faucet Repair)'
    )
    slug = models.SlugField(
        max_length=180,
        unique=True,
        db_index=True,
        help_text='URL-friendly service identifier'
    )
    description = models.TextField(
        blank=True,
        default='',
        help_text='Service scope and typical repair coverage'
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether this service is available for booking'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category__name', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['category', 'name'],
                name='unique_category_service_name'
            )
        ]
        indexes = [
            models.Index(fields=['category', 'is_active']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(f"{self.category.name}-{self.name}")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.category.name} - {self.name}"


class PricingModel(models.TextChoices):
    QUOTATION_BASED = 'QUOTATION_BASED', 'Quotation-based'


class WorkerService(models.Model):
    worker = models.ForeignKey(
        'accounts.WorkerProfile',
        on_delete=models.CASCADE,
        related_name='worker_services',
        help_text='Service professional providing this trade'
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name='worker_offerings',
        help_text='Selected trade or service'
    )
    experience_years = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(0), MaxValueValidator(60)],
        help_text='Years of direct experience for this particular service'
    )
    pricing_model = models.CharField(
        max_length=30,
        choices=PricingModel.choices,
        default=PricingModel.QUOTATION_BASED,
        help_text='Primary pricing method; quotation-based by default'
    )
    inspection_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Optional base inspection / visit fee, clearly distinct from final quotation'
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Whether the worker is currently offering this service'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['worker', 'service'],
                name='unique_worker_service_offering'
            )
        ]

    def __str__(self):
        return f"{self.worker.user.username} offering {self.service.name}"
