import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Search, ArrowRight, Filter, Wrench, MapPin } from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

export default function CustomerBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredBookings = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'ALL' ? true : b.status === statusFilter;
    const matchesSearch = searchQuery
      ? (b.service_name && b.service_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.problem_description && b.problem_description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(b.id).includes(searchQuery)
      : true;
    return matchesStatus && matchesSearch;
  });

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
            <span>Home 2 Service History</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
            My Service Bookings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Track and manage all your past and active service requests in Coimbatore
          </p>
        </div>
        <button onClick={() => navigate('/customer/book')} className="btn btn-primary">
          Book New Service
        </button>
      </div>

      <ErrorMessage message={error} retryAction={loadBookings} />

      {/* Filter and Search Bar */}
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
            placeholder="Search by service or booking ID..."
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
        <LoadingSpinner message="Loading your bookings..." />
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          title="No bookings match your filter"
          description="Try selecting a different status or book a new service."
          icon={Calendar}
          actionText="Explore Services"
          onAction={() => navigate('/services')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredBookings.map((b) => (
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
              onClick={() => navigate(`/customer/bookings/${b.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--brand-pale)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brand-blue)',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}
                >
                  <Wrench size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy)', margin: 0 }}>
                      {b.service_name || 'Service Request'}
                    </h3>
                    <StatusBadge status={b.status} />
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '640px', lineHeight: 1.45 }}>
                    {b.problem_description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    <span>Booking ID: <strong>#{String(b.id).slice(0, 8)}</strong></span>
                    <span>&bull;</span>
                    <span><MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} /> {b.service_address_title || b.service_city || 'Coimbatore'}</span>
                    <span>&bull;</span>
                    <span>{new Date(b.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/customer/bookings/${b.id}`);
                }}
                className="btn btn-secondary btn-sm"
              >
                Track &amp; View Details <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
