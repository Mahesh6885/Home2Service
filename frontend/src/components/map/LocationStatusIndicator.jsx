import React from 'react';
import { Activity, AlertCircle, Clock, CheckCircle } from 'lucide-react';

export default function LocationStatusIndicator({
  isAvailable = false,
  isStale = false,
  lastUpdated = null,
  reason = ''
}) {
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Unknown';
    const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const minutes = Math.floor(diffSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!isAvailable) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.75rem',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(156, 163, 175, 0.12)',
          border: '1px solid rgba(156, 163, 175, 0.3)',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          fontWeight: 600
        }}
      >
        <AlertCircle size={14} />
        <span>{reason || 'Location Unavailable'}</span>
      </div>
    );
  }

  if (isStale) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.75rem',
          borderRadius: 'var(--radius-full)',
          background: 'var(--warning-bg)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: 'var(--warning)',
          fontSize: '0.8rem',
          fontWeight: 600
        }}
      >
        <Clock size={14} />
        <span>Location last updated {formatTimeAgo(lastUpdated)} (Stale)</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 0.75rem',
        borderRadius: 'var(--radius-full)',
        background: 'var(--success-bg)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        color: 'var(--success)',
        fontSize: '0.8rem',
        fontWeight: 600
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--success)',
          display: 'inline-block',
          boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)'
        }}
      />
      <span>Live Tracking Active &bull; {formatTimeAgo(lastUpdated)}</span>
    </div>
  );
}
