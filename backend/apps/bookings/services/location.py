import math
from decimal import Decimal
from typing import Tuple

# Mean radius of Earth in kilometres (IUGG standard)
EARTH_RADIUS_KM = 6371.0088

# Coimbatore approximate administrative bounding box
COIMBATORE_MIN_LAT = Decimal('10.700000')
COIMBATORE_MAX_LAT = Decimal('11.300000')
COIMBATORE_MIN_LON = Decimal('76.700000')
COIMBATORE_MAX_LON = Decimal('77.300000')


def validate_coordinates(lat: float, lon: float) -> None:
    """Validates that latitude and longitude are within standard geographical boundaries."""
    if lat < -90.0 or lat > 90.0:
        raise ValueError(f"Latitude must be between -90 and 90 degrees. Got {lat}")
    if lon < -180.0 or lon > 180.0:
        raise ValueError(f"Longitude must be between -180 and 180 degrees. Got {lon}")


def is_within_coimbatore_bounds(lat: Decimal | float, lon: Decimal | float) -> bool:
    """Verifies whether a given point falls inside the operational Coimbatore bounding region."""
    lat_dec = Decimal(str(lat))
    lon_dec = Decimal(str(lon))
    return bool(
        COIMBATORE_MIN_LAT <= lat_dec <= COIMBATORE_MAX_LAT and
        COIMBATORE_MIN_LON <= lon_dec <= COIMBATORE_MAX_LON
    )


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two points on the Earth's surface in kilometres
    using the Haversine formula.
    """
    # Fast path for identical coordinates
    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    validate_coordinates(lat1, lon1)
    validate_coordinates(lat2, lon2)

    # Convert degrees to radians
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Haversine formulation
    a = (
        math.sin(delta_phi / 2.0) ** 2 +
        math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2)
    )
    
    # Protect against floating-point inaccuracies slightly exceeding 1.0
    a = min(1.0, max(0.0, a))
    
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c


def get_bounding_box(lat: float, lon: float, radius_km: float = 5.0) -> Tuple[Decimal, Decimal, Decimal, Decimal]:
    """
    Calculates latitude and longitude bounding box coordinates around a central point
    to efficiently prefilter database records prior to calculating Haversine distance.
    """
    validate_coordinates(lat, lon)
    
    # 1 degree of latitude is approximately 111 km
    lat_delta = radius_km / 111.0
    
    # 1 degree of longitude is approximately 111 km * cos(latitude)
    rad_lat = math.radians(lat)
    cos_lat = math.cos(rad_lat)
    if abs(cos_lat) < 1e-6:
        # Near poles
        lon_delta = 180.0
    else:
        lon_delta = radius_km / (111.0 * abs(cos_lat))

    min_lat = Decimal(str(max(-90.0, lat - lat_delta)))
    max_lat = Decimal(str(min(90.0, lat + lat_delta)))
    min_lon = Decimal(str(max(-180.0, lon - lon_delta)))
    max_lon = Decimal(str(min(180.0, lon + lon_delta)))

    return min_lat, max_lat, min_lon, max_lon
