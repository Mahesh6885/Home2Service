from rest_framework import serializers
from .models import ServiceCategory, Service, WorkerService, PricingModel
from decimal import Decimal

class ServiceCategorySerializer(serializers.ModelSerializer):
    services_count = serializers.SerializerMethodField()

    class Meta:
        model = ServiceCategory
        fields = [
            'id', 'name', 'slug', 'description', 'icon',
            'is_active', 'services_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'services_count']

    def get_services_count(self, obj):
        return obj.services.filter(is_active=True).count()


class ServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source='category.name')
    category_slug = serializers.ReadOnlyField(source='category.slug')

    class Meta:
        model = Service
        fields = [
            'id', 'category', 'category_name', 'category_slug',
            'name', 'slug', 'description', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'category_name', 'category_slug']

    def validate(self, attrs):
        category = attrs.get('category') or getattr(self.instance, 'category', None)
        name = attrs.get('name') or getattr(self.instance, 'name', None)
        
        # Check uniqueness constraint within category
        existing = Service.objects.filter(category=category, name=name)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError({"name": "A service with this name already exists in this category."})
        return attrs


class WorkerServiceSerializer(serializers.ModelSerializer):
    service_details = ServiceSerializer(source='service', read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        source='service',
        write_only=True
    )

    class Meta:
        model = WorkerService
        fields = [
            'id', 'worker', 'service_id', 'service_details',
            'experience_years', 'pricing_model', 'inspection_fee',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'worker', 'created_at', 'updated_at', 'service_details']

    def validate_experience_years(self, value):
        if value < 0:
            raise serializers.ValidationError("Experience years cannot be negative.")
        if value > 60:
            raise serializers.ValidationError("Experience years cannot exceed 60.")
        return value

    def validate_inspection_fee(self, value):
        if value is not None and value < Decimal('0.00'):
            raise serializers.ValidationError("Inspection fee cannot be negative.")
        return value

    def validate_service_id(self, service):
        if not service.is_active:
            raise serializers.ValidationError("Cannot offer an inactive service.")
        if not service.category.is_active:
            raise serializers.ValidationError("Cannot offer a service belonging to an inactive category.")
        return service

    def validate(self, attrs):
        request = self.context.get('request')
        worker = getattr(request.user, 'worker_profile', None)
        service = attrs.get('service') or getattr(self.instance, 'service', None)

        if not self.instance and worker and service:
            if WorkerService.objects.filter(worker=worker, service=service).exists():
                raise serializers.ValidationError({"service_id": "You have already added this service offering to your profile."})

        return attrs
