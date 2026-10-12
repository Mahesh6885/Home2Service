import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export default function ErrorMessage({ message, onDismiss, retryAction }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        background: 'var(--danger-bg)',
        border: '1px solid var(--danger-border)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--danger)',
        marginBottom: '1.25rem',
        fontSize: '0.9rem'
      }}
    >
      <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        <p style={{ color: 'var(--danger)', fontWeight: 500, margin: 0 }}>{message}</p>
        {retryAction && (
          <button
            type="button"
            onClick={retryAction}
            style={{
              marginTop: '0.4rem',
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              textDecoration: 'underline',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8, padding: '2px' }}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
