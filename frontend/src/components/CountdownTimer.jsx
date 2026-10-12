import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function CountdownTimer({ expiresAt, onExpire }) {
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    if (!expiresAt) return 60;
    const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    return diff;
  });

  useEffect(() => {
    if (!expiresAt) return;

    const initialDiff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    if (initialDiff <= 0) {
      if (onExpire) onExpire();
      return;
    }

    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const isUrgent = secondsRemaining <= 15;
  const isExpired = secondsRemaining <= 0;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem 0.65rem',
        borderRadius: 'var(--radius-sm)',
        background: isExpired
          ? 'var(--bg-surface-elevated)'
          : isUrgent
          ? 'var(--danger-bg)'
          : 'var(--warning-bg)',
        border: `1px solid ${isExpired ? 'var(--border-subtle)' : isUrgent ? 'var(--danger-border)' : 'var(--warning-border)'}`,
        color: isExpired ? 'var(--text-muted)' : isUrgent ? 'var(--danger)' : 'var(--warning)',
        fontSize: '0.825rem',
        fontWeight: 700
      }}
    >
      <Clock size={14} />
      <span>{isExpired ? 'Offer Expired' : `${secondsRemaining}s remaining`}</span>
    </div>
  );
}
