from rest_framework import serializers
from django.utils import timezone
from apps.services.models import Service
from apps.accounts.models import Address
from apps.bookings.models import Booking, WorkerOffer, BookingStatus, OfferStatus

class BookingCreateSerializer(serializers.Serializer):
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        source='service'
    )
    address_id = serializers.PrimaryKeyRelatedField(
        queryset=Address.objects.all(),
        source='address'
    )
    problem_description = serializers.CharField(
        min_length=10,
        max_length=2000
    )

    def validate_service_id(self, service):
        if not (service.is_active and service.category.is_active):
            raise serializers.ValidationError("Cannot book an inactive service or a service in an inactive category.")
        return service

    def validate_address_id(self, address):
        request = self.context.get('request')
        if request and address.user != request.user:
            raise serializers.ValidationError("The selected address does not belong to you.")
        return address


class BookingDetailSerializer(serializers.ModelSerializer):
    service_name = serializers.ReadOnlyField(source='service.name')
    category_name = serializers.ReadOnlyField(source='service.category.name')
    customer_name = serializers.ReadOnlyField(source='customer.get_full_name')
    assigned_worker_name = serializers.SerializerMethodField()
    assigned_worker_phone = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            'id', 'customer', 'customer_name', 'service', 'service_name', 'category_name',
            'status', 'travel_status', 'worker_heading_at', 'worker_arrived_at',
            'estimated_arrival_minutes', 'delay_reason',
            'assigned_worker', 'assigned_worker_name', 'assigned_worker_phone',
            'service_address_title', 'service_address_line', 'service_landmark',
            'service_city', 'service_pincode', 'service_latitude', 'service_longitude',
            'problem_description', 'dispatch_round', 'cancellation_reason',
            'assigned_at', 'cancelled_at', 'completed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_assigned_worker_name(self, obj):
        if obj.assigned_worker:
            return obj.assigned_worker.user.get_full_name() or obj.assigned_worker.user.username
        return None

    def get_assigned_worker_phone(self, obj):
        # Reveal worker contact only to the customer whose booking is assigned
        request = self.context.get('request')
        if obj.assigned_worker and request and (obj.customer == request.user or request.user.role == 'ADMIN'):
            return obj.assigned_worker.user.phone_number
        return None


class WorkerDelaySerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=500)
    estimated_minutes = serializers.IntegerField(min_value=1, max_value=240, required=False, allow_null=True)


class NoShowReportCreateSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=1000)


class NoShowReportSerializer(serializers.ModelSerializer):
    from apps.bookings.models import NoShowReport
    reported_by_username = serializers.ReadOnlyField(source='reported_by.username')
    assigned_worker_name = serializers.SerializerMethodField()
    resolved_by_username = serializers.ReadOnlyField(source='resolved_by.username')

    class Meta:
        from apps.bookings.models import NoShowReport
        model = NoShowReport
        fields = [
            'id', 'booking', 'reported_by', 'reported_by_username',
            'assigned_worker', 'assigned_worker_name', 'status',
            'reason', 'resolution_notes', 'created_at', 'resolved_at',
            'resolved_by', 'resolved_by_username'
        ]
        read_only_fields = ['id', 'booking', 'reported_by', 'assigned_worker', 'created_at', 'resolved_at', 'resolved_by']

    def get_assigned_worker_name(self, obj):
        if obj.assigned_worker:
            return obj.assigned_worker.user.get_full_name() or obj.assigned_worker.user.username
        return None


class WorkerOfferSerializer(serializers.ModelSerializer):
    service_name = serializers.ReadOnlyField(source='booking.service.name')
    category_name = serializers.ReadOnlyField(source='booking.service.category.name')
    problem_description = serializers.ReadOnlyField(source='booking.problem_description')
    booking_status = serializers.ReadOnlyField(source='booking.status')
    seconds_remaining = serializers.SerializerMethodField()
    approximate_location = serializers.SerializerMethodField()
    full_address = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()

    class Meta:
        model = WorkerOffer
        fields = [
            'id', 'booking_id', 'dispatch_round', 'status', 'booking_status',
            'service_name', 'category_name', 'problem_description',
            'approximate_location', 'full_address', 'customer_phone',
            'sent_at', 'expires_at', 'seconds_remaining', 'responded_at'
        ]
        read_only_fields = fields

    def get_seconds_remaining(self, obj):
        if obj.status != OfferStatus.PENDING:
            return 0
        now = timezone.now()
        diff = (obj.expires_at - now).total_seconds()
        return max(0, int(diff))

    def get_approximate_location(self, obj):
        # Always exposed to candidate workers
        return {
            "city": obj.booking.service_city,
            "landmark": obj.booking.service_landmark or obj.booking.service_address_title,
            "latitude": float(obj.booking.service_latitude),
            "longitude": float(obj.booking.service_longitude),
        }

    def get_full_address(self, obj):
        # Privacy guard: Full address revealed strictly after winning acceptance
        if obj.status == OfferStatus.ACCEPTED:
            return {
                "address_line": obj.booking.service_address_line,
                "landmark": obj.booking.service_landmark,
                "city": obj.booking.service_city,
                "pincode": obj.booking.service_pincode,
            }
        return None

    def get_customer_phone(self, obj):
        # Customer contact revealed only after winning acceptance
        if obj.status == OfferStatus.ACCEPTED:
            return obj.booking.customer.phone_number
        return None
