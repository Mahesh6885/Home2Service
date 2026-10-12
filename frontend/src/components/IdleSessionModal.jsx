import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Clock, ShieldAlert } from 'lucide-react';

export default function IdleSessionModal() {
  const { idleWarning, extendSession, logout } = useAuth();

  if (!idleWarning) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }}>
      <div className="modal-card" style={{ maxWidth: '440px', textAlign: 'center', padding: '2rem 1.75rem' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--warning-bg)',
            color: 'var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}
        >
          <Clock size={24} />
        </div>
        <h3 style={{ color: 'var(--brand-navy)', marginBottom: '0.5rem' }}>Are you still there?</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Your session has been idle for 30 minutes. To protect your Home 2 Service account, you will be automatically logged out shortly unless you choose to stay signed in.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={logout}>
            Sign Out Now
          </button>
          <button className="btn btn-primary" onClick={extendSession}>
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}
