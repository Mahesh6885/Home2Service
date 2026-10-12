from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, UserRole, WorkerProfile, WorkerApprovalStatus, Address
from decimal import Decimal

class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'phone_number', 'role', 'avatar', 'created_at']
        read_only_fields = ['id', 'role', 'created_at']


class WorkerProfileSerializer(serializers.ModelSerializer):
    user = UserPublicSerializer(read_only=True)

    class Meta:
        model = WorkerProfile
        fields = [
            'id', 'user', 'approval_status', 'approval_reason', 'business_name',
            'experience_years', 'id_number', 'id_document', 'latitude', 'longitude',
            'service_radius_km', 'is_available', 'is_active', 'is_eligible_for_dispatch',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'approval_status', 'approval_reason', 'is_eligible_for_dispatch', 'created_at', 'updated_at']


class CustomerRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone_number', 'first_name', 'last_name', 'password', 'password_confirm']
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        user = User.objects.create(
            role=UserRole.CUSTOMER,
            **validated_data
        )
        user.set_password(password)
        user.save()
        return user


class WorkerRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True, required=True)
    business_name = serializers.CharField(required=False, allow_blank=True, default='')
    experience_years = serializers.IntegerField(required=False, default=1)
    id_number = serializers.CharField(required=False, allow_blank=True, default='')
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone_number', 'first_name', 'last_name',
            'password', 'password_confirm', 'business_name', 'experience_years',
            'id_number', 'latitude', 'longitude'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        business_name = validated_data.pop('business_name', '')
        experience_years = validated_data.pop('experience_years', 1)
        id_number = validated_data.pop('id_number', '')
        latitude = validated_data.pop('latitude', None)
        longitude = validated_data.pop('longitude', None)

        user = User.objects.create(
            role=UserRole.WORKER,
            **validated_data
        )
        user.set_password(password)
        user.save()

        # Create linked worker profile pending admin approval
        WorkerProfile.objects.create(
            user=user,
            approval_status=WorkerApprovalStatus.PENDING,
            business_name=business_name,
            experience_years=experience_years,
            id_number=id_number,
            latitude=latitude,
            longitude=longitude,
            is_available=True,
            is_active=True
        )

        return user


class WorkerApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkerProfile
        fields = ['approval_status', 'approval_reason']

    def validate_approval_status(self, value):
        if value not in [WorkerApprovalStatus.APPROVED, WorkerApprovalStatus.REJECTED, WorkerApprovalStatus.SUSPENDED]:
            raise serializers.ValidationError("Invalid approval status choice.")
        return value


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            'id', 'title', 'address_line1', 'address_line2', 'landmark',
            'city', 'pincode', 'latitude', 'longitude', 'is_default',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        # Validate coordinates roughly within Coimbatore area bounds
        # Coimbatore bounding box approx: Lat 10.8 to 11.2, Lon 76.8 to 77.2
        lat = attrs.get('latitude')
        lon = attrs.get('longitude')
        if lat is not None and (lat < Decimal('10.7') or lat > Decimal('11.3')):
            raise serializers.ValidationError({"latitude": "Latitude must be within the Coimbatore service area (approx 10.7° to 11.3° N)."})
        if lon is not None and (lon < Decimal('76.7') or lon > Decimal('77.3')):
            raise serializers.ValidationError({"longitude": "Longitude must be within the Coimbatore service area (approx 76.7° to 77.3° E)."})
        return attrs

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        if validated_data.get('is_default'):
            Address.objects.filter(user=validated_data['user']).update(is_default=False)
        return super().create(validated_data)


class WorkerLocationUpdateSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False)
    is_location_sharing_enabled = serializers.BooleanField(required=False)

    def validate(self, attrs):
        lat = attrs.get('latitude')
        lon = attrs.get('longitude')
        if (lat is not None and lon is None) or (lon is not None and lat is None):
            raise serializers.ValidationError("Both latitude and longitude must be provided together.")
        if lat is not None:
            if lat < Decimal('-90.0') or lat > Decimal('90.0'):
                raise serializers.ValidationError({"latitude": "Latitude must be between -90 and 90 degrees."})
        if lon is not None:
            if lon < Decimal('-180.0') or lon > Decimal('180.0'):
                raise serializers.ValidationError({"longitude": "Longitude must be between -180 and 180 degrees."})
        if lat is None and lon is None and 'is_location_sharing_enabled' not in attrs:
            raise serializers.ValidationError("At least latitude/longitude or is_location_sharing_enabled must be provided.")
        return attrs

