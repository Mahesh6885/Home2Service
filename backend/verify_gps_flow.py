import os
import sys
import django
from decimal import Decimal
from datetime import timedelta

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'multiwork_core.settings')
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import WorkerProfile, Address
from apps.services.models import Service, ServiceCategory
from apps.bookings.models import Booking, BookingStatus, WorkerOffer, OfferStatus
from apps.bookings.services.location import haversine_distance_km

User = get_user_model()

def run_verification():
    print("=" * 70)
    print("MultiWork GPS Live Tracking End-to-End Verification")
    print("=" * 70)
    
    client = APIClient()

    # Step 1: Set up / get test users
    print("\n[Step 1] Setting up customer, assigned worker, and third-party users...")
    
    # Customer
    customer, _ = User.objects.get_or_create(
        email="test_cust_gps@multiwork.in",
        defaults={
            "username": "test_cust_gps",
            "phone_number": "9843000001",
            "first_name": "Kavitha",
            "last_name": "Raman",
            "role": "CUSTOMER"
        }
    )
    customer.set_password("CustPass@123")
    customer.save()

    # Worker
    worker_user, _ = User.objects.get_or_create(
        email="test_worker_gps@multiwork.in",
        defaults={
            "username": "test_worker_gps",
            "phone_number": "9843000002",
            "first_name": "Senthil",
            "last_name": "Kumar",
            "role": "WORKER"
        }
    )
    worker_user.set_password("WorkerPass@123")
    worker_user.save()

    worker_profile, _ = WorkerProfile.objects.get_or_create(
        user=worker_user,
        defaults={
            "business_name": "Senthil Plumbing Solutions",
            "approval_status": "APPROVED",
            "is_available": True,
            "latitude": Decimal("11.016800"),
            "longitude": Decimal("76.955800"),
            "service_radius_km": Decimal("5.0"),
            "is_location_sharing_enabled": True
        }
    )
    worker_profile.approval_status = "APPROVED"
    worker_profile.is_available = True
    worker_profile.is_location_sharing_enabled = True
    worker_profile.save()

    # Unauthorized Customer (Mallika)
    unauthorized_user, _ = User.objects.get_or_create(
        email="mallika_unauth@multiwork.in",
        defaults={
            "username": "mallika_unauth",
            "phone_number": "9843000003",
            "first_name": "Mallika",
            "last_name": "Devi",
            "role": "CUSTOMER"
        }
    )
    unauthorized_user.set_password("CustPass@123")
    unauthorized_user.save()

    # Unrelated Worker (Vignesh)
    other_worker_user, _ = User.objects.get_or_create(
        email="other_worker_gps@multiwork.in",
        defaults={
            "username": "other_worker_gps",
            "phone_number": "9843000004",
            "first_name": "Vignesh",
            "last_name": "Electric",
            "role": "WORKER"
        }
    )
    other_worker_user.set_password("WorkerPass@123")
    other_worker_user.save()
    other_worker_profile, _ = WorkerProfile.objects.get_or_create(
        user=other_worker_user,
        defaults={
            "business_name": "Vignesh Electric",
            "approval_status": "APPROVED",
            "is_available": True,
            "latitude": Decimal("11.020000"),
            "longitude": Decimal("76.960000")
        }
    )

    # Category & Service
    category, _ = ServiceCategory.objects.get_or_create(
        slug="plumbing-gps",
        defaults={"name": "Plumbing Services", "is_active": True}
    )
    service, _ = Service.objects.get_or_create(
        category=category,
        slug="pipe-leakage-gps",
        defaults={"name": "Pipe Leakage Repair", "description": "Kitchen pipe and valve repairs", "is_active": True}
    )

    # Booking at RS Puram, Coimbatore
    # RS Puram coordinates: 11.008500, 76.945000
    booking, _ = Booking.objects.get_or_create(
        customer=customer,
        service=service,
        problem_description="Major pipe leak under kitchen sink in RS Puram",
        defaults={
            "service_address_title": "Home",
            "service_address_line": "45 DB Road, RS Puram",
            "service_city": "Coimbatore",
            "service_pincode": "641002",
            "service_latitude": Decimal("11.008500"),
            "service_longitude": Decimal("76.945000"),
            "status": BookingStatus.ASSIGNED,
            "assigned_worker": worker_profile
        }
    )
    booking.status = BookingStatus.ASSIGNED
    booking.assigned_worker = worker_profile
    booking.service_latitude = Decimal("11.008500")
    booking.service_longitude = Decimal("76.945000")
    booking.save()

    print(f"   Created booking {booking.id} assigned to worker {worker_profile.business_name}")
    print(f"   Destination: RS Puram ({booking.service_latitude}, {booking.service_longitude})")

    # Step 2: Test Worker GPS Location Update API
    print("\n[Step 2] Worker sending real GPS coordinates to POST /api/workers/me/location/...")
    # Initial location: Gandhipuram (11.0168, 76.9558)
    client.force_authenticate(user=worker_user)
    
    # Reset last update timestamp to avoid throttle on initial run
    worker_profile.last_location_updated_at = timezone.now() - timedelta(seconds=10)
    worker_profile.save()

    loc_payload_1 = {
        "latitude": 11.016800,
        "longitude": 76.955800,
        "is_location_sharing_enabled": True
    }
    res_loc_1 = client.post("/api/workers/me/location/", loc_payload_1, format="json")
    assert res_loc_1.status_code == status.HTTP_200_OK, f"Location update failed: {res_loc_1.data}"
    
    # Reload worker profile from database to verify persistence
    worker_profile.refresh_from_db()
    assert float(worker_profile.latitude) == 11.016800, "Worker latitude not updated in DB"
    assert float(worker_profile.longitude) == 76.955800, "Worker longitude not updated in DB"
    initial_timestamp = worker_profile.last_location_updated_at
    print(f"   [PASS] Position 1 Persisted: Gandhipuram ({worker_profile.latitude}, {worker_profile.longitude}) at {initial_timestamp.isoformat()}")

    # Step 3: Test Rate-Limiting Throttle (Immediate subsequent update)
    print("\n[Step 3] Verifying 5-second server-side rate-limiting throttle...")
    res_throttle = client.post("/api/workers/me/location/", {"latitude": 11.0150, "longitude": 76.9500}, format="json")
    assert res_throttle.status_code == status.HTTP_429_TOO_MANY_REQUESTS, f"Throttle expected 429, got {res_throttle.status_code}"
    print(f"   [PASS] Throttle Enforced: {res_throttle.data.get('detail')}")

    # Step 4: Customer Querying Live Tracking
    print("\n[Step 4] Customer querying GET /api/bookings/<id>/tracking/...")
    client.force_authenticate(user=customer)
    res_track_1 = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_track_1.status_code == status.HTTP_200_OK
    data_1 = res_track_1.data
    assert data_1["tracking_available"] is True
    assert data_1["is_location_available"] is True
    assert data_1["worker_latitude"] == 11.0168
    assert data_1["worker_longitude"] == 76.9558
    assert data_1["is_stale"] is False
    expected_dist_1 = round(haversine_distance_km(11.008500, 76.945000, 11.016800, 76.955800), 2)
    assert data_1["distance_km"] == expected_dist_1
    print(f"   [PASS] Tracking Response: Available={data_1['tracking_available']}, Stale={data_1['is_stale']}, Distance={data_1['distance_km']} km")
    print(f"   [PASS] Coordinates Received: Lat={data_1['worker_latitude']}, Lng={data_1['worker_longitude']}")

    # Step 5: Worker Moves Closer (Simulated real-device movement along Cross Cut Rd towards RS Puram)
    print("\n[Step 5] Worker moving closer towards RS Puram (Cross Cut Road -> DB Road)...")
    # Advance time beyond 5-second throttle
    worker_profile.last_location_updated_at = timezone.now() - timedelta(seconds=6)
    worker_profile.save()

    client.force_authenticate(user=worker_user)
    # New coordinates: 11.011000, 76.948000 (closer to RS Puram)
    loc_payload_2 = {
        "latitude": 11.011000,
        "longitude": 76.948000,
        "is_location_sharing_enabled": True
    }
    res_loc_2 = client.post("/api/workers/me/location/", loc_payload_2, format="json")
    assert res_loc_2.status_code == status.HTTP_200_OK

    worker_profile.refresh_from_db()
    new_timestamp = worker_profile.last_location_updated_at
    assert new_timestamp > initial_timestamp, "Timestamp must update on new GPS report"
    print(f"   [PASS] Position 2 Persisted: Midpoint ({worker_profile.latitude}, {worker_profile.longitude}) at {new_timestamp.isoformat()}")

    # Customer re-queries tracking (simulating 12s polling interval)
    client.force_authenticate(user=customer)
    res_track_2 = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_track_2.status_code == status.HTTP_200_OK
    data_2 = res_track_2.data
    assert data_2["worker_latitude"] == 11.0110
    assert data_2["worker_longitude"] == 76.9480
    assert data_2["distance_km"] < data_1["distance_km"], "Distance must decrease as worker approaches customer"
    print(f"   [PASS] Live Marker Movement Verified: New distance = {data_2['distance_km']} km (decreased from {data_1['distance_km']} km)")

    # Step 6: Test Stale Coordinates Detection (>15 minutes threshold)
    print("\n[Step 6] Testing stale coordinate detection when GPS updates cease...")
    worker_profile.last_location_updated_at = timezone.now() - timedelta(minutes=20)
    worker_profile.save()

    client.force_authenticate(user=customer)
    res_stale = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_stale.status_code == status.HTTP_200_OK
    assert res_stale.data["is_stale"] is True, "Must flag is_stale=True when older than 15 minutes"
    print(f"   [PASS] Stale Detection Verified: is_stale={res_stale.data['is_stale']}, last_updated_at={res_stale.data['last_updated_at']}")

    # Step 7: Test Worker Disabling Location Sharing
    print("\n[Step 7] Testing worker pausing location sharing...")
    client.force_authenticate(user=worker_user)
    res_disable = client.post("/api/workers/me/location/", {"is_location_sharing_enabled": False}, format="json")
    assert res_disable.status_code == status.HTTP_200_OK
    worker_profile.refresh_from_db()
    assert worker_profile.is_location_sharing_enabled is False

    client.force_authenticate(user=customer)
    res_paused = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_paused.status_code == status.HTTP_200_OK
    assert res_paused.data["tracking_available"] is False
    assert "paused" in res_paused.data["reason"].lower()
    assert "worker_latitude" not in res_paused.data
    print(f"   [PASS] Location Privacy Verified: {res_paused.data['reason']}")

    # Restore sharing
    worker_profile.is_location_sharing_enabled = True
    worker_profile.last_location_updated_at = timezone.now()
    worker_profile.save()

    # Step 8: Security & BOLA Authorization Checks
    print("\n[Step 8] Testing authorization guards (unauthorized customers & unrelated workers)...")
    # Unauthorized customer
    client.force_authenticate(user=unauthorized_user)
    res_unauth = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_unauth.status_code == status.HTTP_403_FORBIDDEN
    print(f"   [PASS] BOLA Protected: Unrelated customer receives HTTP {res_unauth.status_code}")

    # Unrelated worker
    client.force_authenticate(user=other_worker_user)
    res_other_worker = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_other_worker.status_code == status.HTTP_403_FORBIDDEN
    print(f"   [PASS] BOLA Protected: Unrelated worker receives HTTP {res_other_worker.status_code}")

    # Unauthenticated request
    client.logout()
    res_anon = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_anon.status_code == status.HTTP_401_UNAUTHORIZED
    print(f"   [PASS] Auth Guard: Unauthenticated user receives HTTP {res_anon.status_code}")

    # Step 9: Lifecycle Termination (Completed and Cancelled states)
    print("\n[Step 9] Testing tracking termination upon booking completion...")
    client.force_authenticate(user=customer)
    booking.status = BookingStatus.COMPLETED
    booking.save()

    res_completed = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_completed.status_code == status.HTTP_200_OK
    assert res_completed.data["tracking_available"] is False
    assert "completed" in res_completed.data["reason"].lower()
    assert "worker_latitude" not in res_completed.data
    print(f"   [PASS] Completed Booking: {res_completed.data['reason']}")

    booking.status = BookingStatus.CANCELLED
    booking.save()
    res_cancelled = client.get(f"/api/bookings/{booking.id}/tracking/")
    assert res_cancelled.status_code == status.HTTP_200_OK
    assert res_cancelled.data["tracking_available"] is False
    assert "cancelled" in res_cancelled.data["reason"].lower()
    print(f"   [PASS] Cancelled Booking: {res_cancelled.data['reason']}")

    # Step 10: Coordinate Mapping & Physical Location Verification
    print("\n[Step 10] Verifying coordinate mapping accuracy (Leaflet [lat, lng] vs geographic location)...")
    lat1, lng1 = 11.01684, 76.95583
    lat2, lng2 = 11.00850, 76.94500
    calc_dist = haversine_distance_km(lat1, lng1, lat2, lng2)
    print(f"   Gandhipuram -> RS Puram Haversine Distance: {calc_dist:.2f} km")
    assert 1.2 <= calc_dist <= 2.2, f"Distance {calc_dist} out of expected range for Gandhipuram-RS Puram"
    print(f"   [PASS] Physical Distance verified: {calc_dist:.2f} km matches Coimbatore geography")

    print("\n" + "=" * 70)
    print("ALL 10 VERIFICATION CHECKS PASSED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    run_verification()
