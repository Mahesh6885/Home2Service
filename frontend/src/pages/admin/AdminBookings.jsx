import React, { useState, useEffect } from 'react';
import { CheckSquare, Search, Filter, Calendar, MapPin, User } from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/admin/bookings/');
      const list = Array.isArray(data) ? data : (data.results || []);
      setBookings(list);
    } catch (err) {
      setError(err.message || 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'ALL' ? true : b.status === statusFilter;
    const matchesSearch = searchQuery
      ? (b.service_name && b.service_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.customer_username && b.customer_username.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(b.id).includes(searchQuery)
      : true;
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
            <span>Home 2 Service Operational Monitoring</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
            All Platform Bookings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Real-time monitoring of all service dispatches, quotations, and active repairs across Coimbatore
          </p>
        </div>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} retryAction={loadBookings} />

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '460px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search by customer, service, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="REQUESTED">Requested</option>
            <option value="SEARCHING">Searching</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="QUOTE_PENDING">Quote Pending</option>
            <option value="QUOTE_ACCEPTED">Quote Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading platform bookings..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No bookings match your filter"
          description="Try selecting a different status filter or search query."
          icon={CheckSquare}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((b) => (
            <div
              key={b.id}
              className="card card-interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem',
                padding: '1.5rem',
                borderLeft: '5px solid var(--brand-blue)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy)', margin: 0 }}>
                    {b.service_name || 'Service Job'}
                  </h3>
                  <StatusBadge status={b.status} />
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 0.25rem' }}>
                  Customer: <strong style={{ color: 'var(--brand-navy)' }}>{b.customer_username || 'Customer'}</strong> &bull; ID: #{String(b.id).slice(0, 8)} &bull; Round {b.dispatch_round}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  <MapPin size={12} style={{ display: 'inline', marginRight: '3px', color: 'var(--brand-blue)' }} />
                  {b.service_address_line}, {b.service_city} - {b.service_pincode}
                </p>
                {b.assigned_worker && (
                  <p style={{ fontSize: '0.825rem', color: 'var(--brand-blue)', marginTop: '4px', margin: '4px 0 0', fontWeight: 600 }}>
                    Assigned Worker: {b.assigned_worker.business_name || b.assigned_worker.username}
                  </p>
                )}
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {new Date(b.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
