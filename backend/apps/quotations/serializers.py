from rest_framework import serializers
from decimal import Decimal
from apps.quotations.models import Quotation, QuotationItem, ItemType, QuotationStatus

class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ['id', 'item_type', 'description', 'quantity', 'unit_price', 'line_total']
        read_only_fields = ['id', 'line_total']


class QuotationCreateItemInputSerializer(serializers.Serializer):
    item_type = serializers.ChoiceField(choices=ItemType.choices, default=ItemType.LABOR)
    description = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=8, decimal_places=2, default=Decimal('1.00'))
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)

    def validate_quantity(self, value):
        if value <= Decimal('0.00'):
            raise serializers.ValidationError("Quantity must be greater than zero.")
        return value

    def validate_unit_price(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value


class QuotationCreateSerializer(serializers.Serializer):
    work_description = serializers.CharField(min_length=10, max_length=5000)
    labor_charge = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=Decimal('0.00'))
    materials_charge = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=Decimal('0.00'))
    other_charges = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=Decimal('0.00'))
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    items = QuotationCreateItemInputSerializer(many=True, required=False, default=list)

    def validate_labor_charge(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Labor charge cannot be negative.")
        return value

    def validate_materials_charge(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Materials charge cannot be negative.")
        return value

    def validate_other_charges(self, value):
        if value < Decimal('0.00'):
            raise serializers.ValidationError("Other charges cannot be negative.")
        return value


class QuotationDetailSerializer(serializers.ModelSerializer):
    worker_name = serializers.ReadOnlyField(source='worker.user.get_full_name')
    worker_business = serializers.ReadOnlyField(source='worker.business_name')
    items = QuotationItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id', 'booking_id', 'worker_id', 'worker_name', 'worker_business',
            'revision_number', 'status', 'labor_charge', 'materials_charge',
            'other_charges', 'total_amount', 'work_description', 'notes',
            'customer_notes', 'responded_at', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = fields


class QuotationDeclineSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default='')
