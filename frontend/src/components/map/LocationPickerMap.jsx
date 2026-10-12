import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import CurrentLocationButton from './CurrentLocationButton';
import { MapPin, Search, Navigation } from 'lucide-react';

const COIMBATORE_DEFAULT_LAT = parseFloat(import.meta.env.VITE_COIMBATORE_DEFAULT_LAT) || 11.0168;
const COIMBATORE_DEFAULT_LNG = parseFloat(import.meta.env.VITE_COIMBATORE_DEFAULT_LNG) || 76.9558;
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const GEOCODING_API_URL = import.meta.env.VITE_GEOCODING_API_URL || 'https://nominatim.openstreetmap.org/reverse';

// Coimbatore bounding box: roughly Lat 10.75 - 11.25, Lng 76.75 - 77.25
export const isWithinCoimbatoreRegion = (lat, lng) => {
  return lat >= 10.70 && lat <= 11.35 && lng >= 76.70 && lng <= 77.35;
};

// Custom SVG Pin Icon for Customer Location
const createPickerIcon = () => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="position: relative; width: 36px; height: 42px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 24 24" width="36" height="42" style="filter: drop-shadow(0 4px 8px rgba(15, 157, 138, 0.45));">
          <path fill="#0F9D8A" stroke="#ffffff" stroke-width="1.5" d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z"/>
          <circle cx="12" cy="10" r="3.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

export default function LocationPickerMap({
  latitude = COIMBATORE_DEFAULT_LAT,
  longitude = COIMBATORE_DEFAULT_LNG,
  onLocationSelect = () => {},
  height = '320px',
  readOnly = false
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [currentCoords, setCurrentCoords] = useState({
    latitude: latitude || COIMBATORE_DEFAULT_LAT,
    longitude: longitude || COIMBATORE_DEFAULT_LNG
  });
  const [geocodedAddress, setGeocodedAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');

  // Reverse geocoding via OpenStreetMap Nominatim
  const performReverseGeocode = useCallback(async (lat, lng) => {
    setIsGeocoding(true);
    setWarningMsg('');
    try {
      const url = `${GEOCODING_API_URL}?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const addr = data.address || {};
      const street = addr.road || addr.suburb || addr.neighbourhood || addr.residential || '';
      const area = addr.suburb || addr.city_district || addr.county || '';
      const pincode = addr.postcode || '';
      const displayName = data.display_name || '';

      const summary = displayName || [street, area, 'Coimbatore', pincode].filter(Boolean).join(', ');
      setGeocodedAddress(summary);

      onLocationSelect({
        latitude: lat,
        longitude: lng,
        address: summary,
        street,
        area,
        pincode,
        raw: data
      });
    } catch (err) {
      console.warn('Reverse geocoding unavailable or rate-limited:', err.message);
      // Fallback
      setGeocodedAddress('');
      onLocationSelect({
        latitude: lat,
        longitude: lng,
        address: '',
        raw: null
      });
    } finally {
      setIsGeocoding(false);
    }
  }, [onLocationSelect]);

  // Handle position update
  const updatePosition = useCallback((newLat, newLng, shouldReverse = true) => {
    const lat = parseFloat(Number(newLat).toFixed(6));
    const lng = parseFloat(Number(newLng).toFixed(6));
    
    if (!isWithinCoimbatoreRegion(lat, lng)) {
      setWarningMsg('Selected point appears outside Coimbatore metropolitan area. Eligible worker radius matching may be limited.');
    } else {
      setWarningMsg('');
    }

    setCurrentCoords({ latitude: lat, longitude: lng });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng]);
    }

    if (shouldReverse) {
      performReverseGeocode(lat, lng);
    }
  }, [performReverseGeocode]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const initialLat = currentCoords.latitude || COIMBATORE_DEFAULT_LAT;
    const initialLng = currentCoords.longitude || COIMBATORE_DEFAULT_LNG;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 14,
      scrollWheelZoom: true
    });

    L.tileLayer(TILE_URL, {
      attribution: MAP_ATTRIBUTION,
      maxZoom: 19
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      icon: createPickerIcon(),
      draggable: !readOnly
    }).addTo(map);

    if (!readOnly) {
      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        updatePosition(lat, lng, true);
      });

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        updatePosition(lat, lng, true);
      });
    }

    mapInstanceRef.current = map;
    markerRef.current = marker;

    // Initial reverse geocode if address not yet set
    performReverseGeocode(initialLat, initialLng);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []); // Run once on mount

  // Sync coords if external props change substantially
  useEffect(() => {
    if (latitude && longitude) {
      const latDiff = Math.abs(currentCoords.latitude - latitude);
      const lngDiff = Math.abs(currentCoords.longitude - longitude);
      if (latDiff > 0.0001 || lngDiff > 0.0001) {
        updatePosition(latitude, longitude, false);
      }
    }
  }, [latitude, longitude, updatePosition]);

  const handleLocationAcquired = (coords) => {
    updatePosition(coords.latitude, coords.longitude, true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <MapPin size={15} style={{ color: 'var(--accent)' }} />
          <span>Click map or drag the pin to pin-point service address</span>
        </div>
        {!readOnly && (
          <CurrentLocationButton
            onLocationAcquired={handleLocationAcquired}
            buttonText="Use My GPS Location"
          />
        )}
      </div>

      <div
        ref={mapContainerRef}
        style={{
          height: height,
          width: '100%',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          zIndex: 1
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          padding: '0.75rem 0.95rem',
          background: 'var(--bg-main)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.82rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Selected Coordinates: <strong style={{ color: 'var(--text-primary)' }}>{currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}</strong>
          </span>
          {isGeocoding && (
            <span style={{ color: 'var(--accent)', fontStyle: 'italic', fontWeight: 500 }}>Resolving address...</span>
          )}
        </div>
        {geocodedAddress && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
            <span style={{ color: 'var(--text-muted)' }}>Approx. Location: </span>
            {geocodedAddress}
          </div>
        )}
        {warningMsg && (
          <div style={{ color: 'var(--warning)', fontSize: '0.78rem', marginTop: '0.15rem' }}>
            {warningMsg}
          </div>
        )}
      </div>
    </div>
  );
}
