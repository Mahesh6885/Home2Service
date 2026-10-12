import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

export default function NotificationDrawer({ isOpen, onClose }) {
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const { role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  if (!isOpen) return null;

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    onClose();
    if (notif.related_booking_id) {
      if (role === 'WORKER') {
        navigate(`/worker/jobs/${notif.related_booking_id}`);
      } else {
        navigate(`/customer/bookings/${notif.related_booking_id}`);
      }
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: '0',
        width: '360px',
        maxWidth: 'calc(100vw - 24px)',
        background: '#FFFFFF',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 100,
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={17} style={{ color: 'var(--accent)' }} />
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>Notifications</strong>
          {unreadCount > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
              {unreadCount} new
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              title="Mark all as read"
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.875rem' }}>No notifications right now.</p>
          </div>
        ) : (
          notifications.slice(0, 15).map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              style={{
                padding: '0.85rem 1rem',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                background: notif.is_read ? 'transparent' : 'var(--accent-surface)',
                transition: 'background 0.15s ease',
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'flex-start'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = notif.is_read
                  ? 'transparent'
                  : 'var(--accent-surface)')
              }
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: notif.is_read ? 'transparent' : 'var(--accent)',
                  marginTop: '6px',
                  flexShrink: 0
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {notif.title}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  {notif.message}
                </p>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          padding: '0.65rem 1rem',
          textAlign: 'center',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)'
        }}
      >
        <button
          onClick={() => {
            onClose();
            navigate(role === 'WORKER' ? '/worker/notifications' : '/customer/notifications');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: '0.825rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          View all notifications <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
}
