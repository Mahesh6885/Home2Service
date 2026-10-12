import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, ShieldCheck, Clock } from 'lucide-react';
import { api } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

const EVENT_CHOICES = [
  'ALL',
  'BOOKING_CREATED',
  'OFFERS_DISPATCHED',
  'WORKER_ACCEPTED',
  'WORKER_REJECTED',
  'OFFERS_EXPIRED',
  'BOOKING_CANCELLED',
  'BOOKING_RETRIED',
  'QUOTATION_SUBMITTED',
  'QUOTATION_REVISED',
  'QUOTATION_ACCEPTED',
  'QUOTATION_DECLINED',
  'WORK_STARTED',
  'WORK_COMPLETED',
  'WORKER_APPROVAL_UPDATED'
];

export default function AdminAuditEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [bookingFilter, setBookingFilter] = useState('');

  useEffect(() => {
    loadAuditEvents();
  }, [selectedEventType]);

  const loadAuditEvents = async () => {
    setLoading(true);
    setError('');
    try {
      let endpoint = '/api/admin/audit-events/?';
      if (selectedEventType !== 'ALL') {
        endpoint += `event_type=${selectedEventType}&`;
      }
      if (bookingFilter.trim()) {
        endpoint += `booking_id=${bookingFilter.trim()}&`;
      }
      const data = await api.get(endpoint);
      const list = data.results || (Array.isArray(data) ? data : []);
      setEvents(list);
    } catch (err) {
      setError(err.message || 'Failed to load audit events.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAuditEvents();
  };

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-blue)', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          <span>Home 2 Service Security &amp; Compliance</span>
        </div>
        <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
          Platform Audit Trail
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
          Immutable PostgreSQL audit log capturing authoritative lifecycle events (passwords &amp; tokens strictly sanitized)
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} retryAction={loadAuditEvents} />

      {/* Filter Toolbar */}
      <form
        onSubmit={handleSearchSubmit}
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-control"
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            style={{ width: 'auto' }}
          >
            {EVENT_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '380px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Filter by Booking UUID..."
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-sm">
          Filter Trail
        </button>
      </form>

      {loading ? (
        <LoadingSpinner message="Loading audit records..." />
      ) : events.length === 0 ? (
        <EmptyState
          title="No audit events found"
          description="No state transition events match your current filter."
          icon={FileText}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              className="card"
              style={{
                padding: '1.5rem',
                borderLeft: '5px solid var(--brand-blue)',
                background: 'var(--bg-surface)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  marginBottom: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-info" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {ev.event_type}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Actor: <strong style={{ color: 'var(--brand-navy)' }}>{ev.actor_username || 'SYSTEM'}</strong>
                  </span>
                  {ev.related_booking_id && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--brand-blue)', fontWeight: 600 }}>
                      Booking: #{String(ev.related_booking_id).slice(0, 8)}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <Clock size={13} />
                  <span>{new Date(ev.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Sanitized Metadata Display */}
              {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                <div
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    fontSize: '0.8125rem',
                    fontFamily: 'monospace',
                    color: 'var(--brand-navy)',
                    overflowX: 'auto',
                    marginTop: '0.75rem'
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(ev.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
