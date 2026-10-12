import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ShieldCheck, ShieldAlert, Radio, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';

export default function LocationSharingControl({
  isAvailableForDispatch = true,
  onStatusChange = null
}) {
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const watchIdRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Fetch initial location status
    fetchCurrentStatus();

    return () => {
      stopLocationWatch();
    };
  }, []);

  const fetchCurrentStatus = async () => {
    try {
      const data = await api.get('/api/workers/me/location/');
      setSharingEnabled(data.is_location_sharing_enabled ?? true);
      setLastUpdate(data.last_location_updated_at);
      if (data.is_location_sharing_enabled && isAvailableForDispatch) {
        startLocationWatch();
      }
    } catch {
      // Quiet fail if not yet configured
    }
  };

  const startLocationWatch = () => {
    if (!navigator.geolocation) return;
    stopLocationWatch();

    // Foreground periodic update every 30 seconds
    const sendUpdate = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await api.post('/api/workers/me/location/', {
              latitude: Number(latitude.toFixed(6)),
              longitude: Number(longitude.toFixed(6)),
              is_location_sharing_enabled: true
            });
            setLastUpdate(res.last_location_updated_at);
            setError('');
          } catch (err) {
            // Rate limit 429 is normal when updating frequently
            if (err.message && !err.message.includes('rate-limited')) {
              setError(err.message);
            }
          }
        },
        (err) => {
          console.warn('Worker GPS reading unavailable:', err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
      );
    };

    // Run first update immediately
    sendUpdate();
    timerRef.current = setInterval(sendUpdate, 30000);
  };

  const stopLocationWatch = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleToggleSharing = async () => {
    const nextState = !sharingEnabled;
    setUpdating(true);
    setError('');
    setFeedback('');

    try {
      const res = await api.post('/api/workers/me/location/', {
        is_location_sharing_enabled: nextState
      });

      setSharingEnabled(nextState);
      setFeedback(nextState ? 'Live location sharing enabled.' : 'Live location sharing paused.');
      if (nextState && isAvailableForDispatch) {
        startLocationWatch();
      } else {
        stopLocationWatch();
      }
      if (onStatusChange) onStatusChange(nextState);
    } catch (err) {
      setError(err.message || 'Failed to update location sharing preference.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        background: 'var(--bg-main)',
        borderColor: sharingEnabled ? 'rgba(15, 157, 138, 0.35)' : 'var(--border-subtle)',
        padding: '1.25rem',
        marginBottom: '1.5rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: sharingEnabled ? 'var(--accent-surface)' : 'rgba(156, 163, 175, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: sharingEnabled ? 'var(--accent)' : 'var(--text-muted)'
            }}
          >
            <Radio size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '1rem', margin: 0, color: 'var(--primary)' }}>GPS Location Sharing</h4>
              <span className={`badge ${sharingEnabled ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.7rem' }}>
                {sharingEnabled ? 'Sharing Active' : 'Sharing Paused'}
              </span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Allows customers on active jobs to see your arrival progress in real-time.
            </p>
            {lastUpdate && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                Last GPS sync: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleSharing}
          disabled={updating}
          className={`btn btn-sm ${sharingEnabled ? 'btn-secondary' : 'btn-teal'}`}
          style={{ minWidth: '130px' }}
        >
          {updating ? 'Updating...' : sharingEnabled ? 'Pause Sharing' : 'Enable Sharing'}
        </button>
      </div>

      {feedback && (
        <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <ShieldCheck size={14} /> {feedback}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
        Note: Browser GPS sharing operates while this tab is active. Closing the browser automatically pauses live location updates.
      </div>
    </div>
  );
}
