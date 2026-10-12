import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  title = 'No records found',
  description = 'There are currently no items to display.',
  icon: Icon = Inbox,
  actionText,
  onAction
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '3rem 1.5rem',
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        gap: '0.85rem'
      }}
    >
      <div
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'var(--bg-surface-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)'
        }}
      >
        <Icon size={26} />
      </div>
      <div>
        <h4 style={{ marginBottom: '0.35rem', color: 'var(--text-primary)' }}>{title}</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '380px' }}>{description}</p>
      </div>
      {actionText && onAction && (
        <button onClick={onAction} className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>
          {actionText}
        </button>
      )}
    </div>
  );
}
