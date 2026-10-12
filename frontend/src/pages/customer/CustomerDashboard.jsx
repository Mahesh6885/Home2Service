import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Plus, CheckCircle, Clock, ArrowRight, Bell, Wrench, MapPin } from 'lucide-react';
import { api } from '../../api/client';
import { useNotifications } from '../../context/NotificationContext';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

export default function CustomerDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/bookings/');
      const list = Array.isArray(data) ? data : (data.results || []);
      setBookings(list);
    } catch (err) {
      setError(err.message || 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  const activeBookings = bookings.filter((b) =>
    ['REQUESTED', 'SEARCHING', 'ASSIGNED', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(b.status)
  );

  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const recentBookings = bookings.slice(0, 5);

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Welcome Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          padding: '2rem',
          borderLeft: '5px solid var(--brand-blue)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              Coimbatore Customer Portal
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
            Customer Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Manage your service requests, review transparent itemized quotes, and track active repairs in real-time.
          </p>
        </div>

        <Link to="/customer/book" className="btn btn-primary btn-lg">
          <Plus size={18} /> Book a Service
        </Link>
      </div>

      <ErrorMessage message={error} retryAction={loadBookings} />

      {/* Metrics Row */}
      <div className="grid-3" style={{ gap: '1.25rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--brand-pale)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-blue)',
              flexShrink: 0
            }}
          >
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active Requests
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: '2px' }}>
              {activeBookings.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success)',
              flexShrink: 0
            }}
          >
            <CheckCircle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Completed Jobs
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: '2px' }}>
              {completedBookings.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: unreadCount > 0 ? 'var(--warning-bg)' : 'var(--bg-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: unreadCount > 0 ? 'var(--warning)' : 'var(--text-muted)',
              flexShrink: 0
            }}
          >
            <Bell size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Unread Alerts
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: '2px' }}>
              {unreadCount}
            </div>
          </div>
        </div>
      </div>

      {/* Active Requests Highlight */}
      {activeBookings.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--brand-navy)' }}>Active Services &amp; Dispatches</h2>
            <Link to="/customer/bookings" style={{ color: 'var(--brand-blue)', fontSize: '0.875rem', fontWeight: 700 }}>
              View all requests &rarr;
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeBookings.map((b) => (
              <div
                key={b.id}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1.5rem',
                  borderLeft: '5px solid var(--brand-blue)'
                }}
                onClick={() => navigate(`/customer/bookings/${b.id}`)}
              >
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--brand-navy)' }}>
                      {b.service_name || 'Service Request'}
                    </h3>
                    <StatusBadge status={b.status} />
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                    <MapPin size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--brand-blue)' }} />
                    {b.service_address_line || b.service_city || 'Coimbatore'}
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/customer/bookings/${b.id}`);
                  }}
                >
                  View Details &amp; Track <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Bookings List */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--brand-navy)' }}>Recent Service History</h2>
          <Link to="/customer/bookings" style={{ color: 'var(--brand-blue)', fontSize: '0.875rem', fontWeight: 700 }}>
            View full history &rarr;
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading your bookings..." />
        ) : recentBookings.length === 0 ? (
          <EmptyState
            title="No bookings yet"
            description="You have not requested any services yet. Request your first service in seconds."
            icon={Calendar}
            actionText="Book a Service"
            onAction={() => navigate('/services')}
          />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong style={{ color: 'var(--brand-navy)' }}>{b.service_name || 'Service'}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        #{String(b.id).slice(0, 8)}
                      </div>
                    </td>
                    <td>{new Date(b.created_at).toLocaleDateString()}</td>
                    <td>{b.service_address_title || b.service_city || 'Coimbatore'}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/customer/bookings/${b.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem 0.75rem' }}
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
