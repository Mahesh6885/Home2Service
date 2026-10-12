import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import LocationStatusIndicator from './LocationStatusIndicator';
import { Navigation, Focus, MapPin, Shield } from 'lucide-react';

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Customer Destination Pin
const createDestinationIcon = () => {
  return L.divIcon({
    className: 'destination-map-pin',
    html: `
      <div style="position: relative; width: 34px; height: 40px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 24 24" width="34" height="40" style="filter: drop-shadow(0 3px 6px rgba(23, 43, 77, 0.45));">
          <path fill="#172B4D" stroke="#ffffff" stroke-width="1.5" d="M12 2C7.58 2 4 5.58 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8z"/>
          <circle cx="12" cy="10" r="3.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

// Worker Live / Stale Pin with Pulse Effect
const createWorkerIcon = (isStale = false) => {
  const bg = isStale ? '#f59e0b' : '#10b981';
  const pulseRgba = isStale ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.45)';

  return L.divIcon({
    className: 'worker-live-pin',
    html: `
      <div style="position: relative; width: 42px; height: 42px; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: ${pulseRgba};
          animation: map-pulse 2s infinite ease-out;
        "></div>
        <div style="
          position: relative;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: ${bg};
          border: 2.5px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
      </div>
      <style>
        @keyframes map-pulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      </style>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

export default function WorkerLocationMap({
  trackingData = null,
  customerLocation = null, // { latitude, longitude, label }
  workerName = 'Assigned Professional',
  height = '360px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const workerMarkerRef = useRef(null);
  const customerMarkerRef = useRef(null);
  const polylineRef = useRef(null);

  const isLocationAvailable = Boolean(trackingData?.tracking_available ?? trackingData?.is_location_available);
  const workerCoords = {
    latitude: trackingData?.worker_latitude ?? trackingData?.worker_location?.latitude,
    longitude: trackingData?.worker_longitude ?? trackingData?.worker_location?.longitude
  };
  const isStale = trackingData?.is_stale;
  const lastUpdated = trackingData?.last_updated_at;
  const distanceKm = trackingData?.distance_km;
  const trackingReason = trackingData?.reason;

  // Initialize and update Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Determine center
      const defaultCenter = [
        customerLocation?.latitude || 11.0168,
        customerLocation?.longitude || 76.9558
      ];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        scrollWheelZoom: true
      });

      L.tileLayer(TILE_URL, {
        attribution: MAP_ATTRIBUTION,
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Update Customer Destination Marker
    if (customerLocation?.latitude && customerLocation?.longitude) {
      const custLatLng = [customerLocation.latitude, customerLocation.longitude];
      if (!customerMarkerRef.current) {
        customerMarkerRef.current = L.marker(custLatLng, {
          icon: createDestinationIcon()
        }).addTo(map);
        customerMarkerRef.current.bindPopup(`<b>Service Location</b><br/>${customerLocation.label || 'Destination'}`);
      } else {
        customerMarkerRef.current.setLatLng(custLatLng);
      }
    }

    // Update Worker Marker & Route
    if (isLocationAvailable && workerCoords?.latitude && workerCoords?.longitude) {
      const workerLatLng = [workerCoords.latitude, workerCoords.longitude];
      
      if (!workerMarkerRef.current) {
        workerMarkerRef.current = L.marker(workerLatLng, {
          icon: createWorkerIcon(isStale)
        }).addTo(map);
      } else {
        workerMarkerRef.current.setLatLng(workerLatLng);
        workerMarkerRef.current.setIcon(createWorkerIcon(isStale));
      }
      workerMarkerRef.current.bindPopup(
        `<b>${workerName}</b><br/>${isStale ? 'Location Stale' : 'Live On Duty'}${distanceKm != null ? `<br/>Distance: ${distanceKm} km` : ''}`
      );

      // Route polyline between worker and customer
      if (customerLocation?.latitude && customerLocation?.longitude) {
        const custLatLng = [customerLocation.latitude, customerLocation.longitude];
        const latlngs = [workerLatLng, custLatLng];

        if (!polylineRef.current) {
          polylineRef.current = L.polyline(latlngs, {
            color: '#0F9D8A',
            weight: 3.5,
            dashArray: '6, 8',
            opacity: 0.85
          }).addTo(map);
        } else {
          polylineRef.current.setLatLngs(latlngs);
        }

        // Fit bounds comfortably to show both markers
        const bounds = L.latLngBounds([workerLatLng, custLatLng]);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    } else {
      // Worker location unavailable
      if (workerMarkerRef.current) {
        workerMarkerRef.current.remove();
        workerMarkerRef.current = null;
      }
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      if (customerLocation?.latitude && customerLocation?.longitude) {
        map.setView([customerLocation.latitude, customerLocation.longitude], 14);
      }
    }

    return () => {
      // Don't teardown on every render, cleanup handled on unmount
    };
  }, [
    customerLocation?.latitude,
    customerLocation?.longitude,
    customerLocation?.label,
    isLocationAvailable,
    workerCoords.latitude,
    workerCoords.longitude,
    isStale,
    distanceKm,
    workerName
  ]);

  // Teardown map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        workerMarkerRef.current = null;
        customerMarkerRef.current = null;
        polylineRef.current = null;
      }
    };
  }, []);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (
      isLocationAvailable &&
      workerCoords?.latitude &&
      workerCoords?.longitude &&
      customerLocation?.latitude &&
      customerLocation?.longitude
    ) {
      const bounds = L.latLngBounds([
        [workerCoords.latitude, workerCoords.longitude],
        [customerLocation.latitude, customerLocation.longitude]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else if (customerLocation?.latitude && customerLocation?.longitude) {
      map.setView([customerLocation.latitude, customerLocation.longitude], 14);
    }
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          background: 'var(--bg-main)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Navigation size={18} style={{ color: 'var(--accent)' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)' }}>
            Live Worker Tracking
          </h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LocationStatusIndicator
            isAvailable={isLocationAvailable}
            isStale={isStale}
            lastUpdated={lastUpdated}
            reason={trackingReason}
          />

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            onClick={handleRecenter}
            title="Recenter Map"
          >
            <Focus size={13} />
            <span>Recenter</span>
          </button>
        </div>
      </div>

      {/* Map Display */}
      <div
        ref={mapContainerRef}
        style={{
          height: height,
          width: '100%',
          position: 'relative',
          zIndex: 1
        }}
      />

      {/* Footer stats bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.75rem 1.25rem',
          background: 'var(--bg-main)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.83rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-muted)' }}>
            Privacy protected: Live location is active solely while booking is in progress.
          </span>
        </div>

        {isLocationAvailable && distanceKm != null && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 700,
              color: 'var(--accent)',
              background: 'var(--accent-surface)',
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <span>{distanceKm} km away</span>
          </div>
        )}
      </div>
    </div>
  );
}
