import React, { useState } from 'react';
import { Navigation, Loader2 } from 'lucide-react';

export default function CurrentLocationButton({
  onLocationFound,
  onLocationAcquired,
  onError,
  buttonText = 'Use My Current Location',
  className = 'btn btn-secondary btn-sm',
  style = {}
}) {
  const [detecting, setDetecting] = useState(false);
  const [internalError, setInternalError] = useState('');

  const callback = onLocationFound || onLocationAcquired;

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      if (onError) onError(msg);
      return;
    }

    setDetecting(true);
    setInternalError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDetecting(false);
        const { latitude, longitude, accuracy } = position.coords;
        if (callback) {
          callback({ latitude, longitude, accuracy });
        }
      },
      (error) => {
        setDetecting(false);
        let errorMsg = 'Unable to retrieve location.';
        if (error.code === 1 || error.code === error.PERMISSION_DENIED) {
          errorMsg = 'GPS access denied. You can manually place the pin on the map.';
        } else if (error.code === 2 || error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is currently unavailable.';
        } else if (error.code === 3 || error.code === error.TIMEOUT) {
          errorMsg = 'Location detection timed out. Please try again.';
        } else {
          errorMsg = error.message || 'Failed to detect location.';
        }
        setInternalError(errorMsg);
        if (onError) onError(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <button
        type="button"
        onClick={handleGetCurrentLocation}
        disabled={detecting}
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', ...style }}
        title="Request GPS location from your browser"
      >
        {detecting ? (
          <>
            <Loader2 size={15} className="spinner-icon" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Detecting Location...</span>
          </>
        ) : (
          <>
            <Navigation size={15} />
            <span>{buttonText}</span>
          </>
        )}
      </button>
      {internalError && (
        <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          {internalError}
        </span>
      )}
    </div>
  );
}
