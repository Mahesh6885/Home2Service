import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink, ArrowRight } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

export default function CustomerNotifications() {
  const { notifications, fetchNotifications, markAsRead, markAllAsRead, loading } = useNotifications();
  const { role } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications(unreadOnly);
  }, [unreadOnly, fetchNotifications]);

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }
    if (notif.related_booking_id) {
      if (role === 'WORKER') {
        navigate(`/worker/jobs/${notif.related_booking_id}`);
      } else {
        navigate(`/customer/bookings/${notif.related_booking_id}`);
      }
    }
  };

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-blue)', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
            <span>Home 2 Service Alerts</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
            Notification Inbox
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Real-time in-app updates for job offers, assignments, quotation approvals, and dispatch progress
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
          >
            {unreadOnly ? 'Show All' : 'Unread Only'}
          </button>
          <button onClick={markAllAsRead} className="btn btn-secondary btn-sm">
            <CheckCheck size={14} /> Mark All Read
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          description={unreadOnly ? 'You have caught up with all notifications.' : 'No alerts have been generated yet.'}
          icon={Bell}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className="card card-interactive"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                cursor: 'pointer',
                background: notif.is_read ? 'var(--bg-surface)' : 'var(--brand-pale)',
                borderColor: notif.is_read ? 'var(--border-subtle)' : 'rgba(8, 127, 186, 0.3)',
                borderLeft: notif.is_read ? '1px solid var(--border-subtle)' : '4px solid var(--brand-blue)',
                transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: notif.is_read ? 'transparent' : 'var(--brand-blue)',
                    marginTop: '6px',
                    flexShrink: 0
                  }}
                />
                <div>
                  <h4 style={{ fontSize: '1rem', margin: 0, color: 'var(--brand-navy)', fontWeight: notif.is_read ? 600 : 700 }}>
                    {notif.title}
                  </h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0.5rem', lineHeight: 1.45 }}>
                    {notif.message}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(notif.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              {notif.related_booking_id && (
                <div style={{ color: 'var(--brand-blue)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>
                  View <ArrowRight size={14} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
