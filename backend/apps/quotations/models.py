import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator

class QuotationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Customer Review'
    ACCEPTED = 'ACCEPTED', 'Accepted by Customer'
    DECLINED = 'DECLINED', 'Declined by Customer'
    SUPERSEDED = 'SUPERSEDED', 'Superseded by Newer Revision'
    WITHDRAWN = 'WITHDRAWN', 'Withdrawn by Worker'


class ItemType(models.TextChoices):
    LABOR = 'LABOR', 'Labor / Professional Service'
    MATERIAL = 'MATERIAL', 'Materials / Replacement Parts'
    OTHER = 'OTHER', 'Other / Incidental Consumables'


class Quotation(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text='Unique identifier for this quotation'
    )
    booking = models.ForeignKey(
        'bookings.Booking',
        on_delete=models.CASCADE,
        related_name='quotations',
        help_text='Booking for which this quotation is issued'
    )
    worker = models.ForeignKey(
        'accounts.WorkerProfile',
        on_delete=models.PROTECT,
        related_name='submitted_quotations',
        help_text='Assigned service professional providing this quotation'
    )
    revision_number = models.PositiveIntegerField(
        default=1,
        help_text='Revision iteration number for this booking'
    )
    status = models.CharField(
        max_length=20,
        choices=QuotationStatus.choices,
        default=QuotationStatus.PENDING,
        db_index=True
    )
    labor_charge = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Total labor charges'
    )
    materials_charge = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Total materials or replacement parts charges'
    )
    other_charges = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Optional additional charges'
    )
    total_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Server-calculated total amount (labor + materials + other)'
    )
    work_description = models.TextField(
        help_text='Itemized breakdown and description of work to be performed'
    )
    notes = models.TextField(
        blank=True,
        default='',
        help_text='Additional notes or warranty terms provided by the worker'
    )
    customer_notes = models.TextField(
        blank=True,
        default='',
        help_text='Customer comments or reason when responding to quotation'
    )
    responded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Timestamp when customer accepted or declined'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-revision_number', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'revision_number'],
                name='unique_booking_quotation_revision'
            )
        ]
        indexes = [
            models.Index(fields=['booking', 'status']),
            models.Index(fields=['worker', 'status']),
        ]

    def __str__(self):
        return f"Quotation {self.id} (Rev {self.revision_number}) for Booking {self.booking_id} [{self.status}]"


class QuotationItem(models.Model):
    quotation = models.ForeignKey(
        Quotation,
        on_delete=models.CASCADE,
        related_name='items',
        help_text='Parent quotation'
    )
    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
        default=ItemType.LABOR
    )
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal('1.00'),
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    line_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))]
    )

    class Meta:
        ordering = ['id']

    def save(self, *args, **kwargs):
        # Enforce server-side line total calculation
        self.line_total = round(self.quantity * self.unit_price, 2)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_type}: {self.description} ({self.quantity} x {self.unit_price} = {self.line_total})"
