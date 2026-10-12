import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, CheckCircle, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '../../api/client';
import CountdownTimer from '../../components/CountdownTimer';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

export default function WorkerOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/workers/me/offers/');
      const list = Array.isArray(data) ? data : (data.results || []);
      setOffers(list);
    } catch (err) {
      setError(err.message || 'Failed to load offers.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId) => {
    setActionLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/api/workers/me/offers/${offerId}/accept/`);
      const booking = res.booking || res;
      setSuccessMsg('Congratulations! You won the assignment. Redirecting to job details...');
      setTimeout(() => {
        navigate(`/worker/jobs/${booking.id || booking.booking_id}`);
      }, 1200);
    } catch (err) {
      // Handles 409 conflict, expiry, or assignment race loss
      setError(err.message || 'Failed to accept offer. Another professional may have won or the 60s window expired.');
      loadOffers();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOffer = async (offerId) => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/workers/me/offers/${offerId}/reject/`, { reason: 'Declined by professional' });
      setSuccessMsg('Offer declined.');
      loadOffers();
    } catch (err) {
      setError(err.message || 'Failed to decline offer.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingOffers = offers.filter((o) => o.status === 'PENDING');
  const pastOffers = offers.filter((o) => o.status !== 'PENDING');

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-blue)', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          <span>Home 2 Service Live Dispatch Queue</span>
        </div>
        <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
          Broadcast Job Offers
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
          Review live service requests in your Coimbatore operating radius. Fast acceptance wins the job assignment!
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} retryAction={loadOffers} />

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '1rem 1.25rem',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success)',
            fontSize: '0.925rem',
            fontWeight: 500
          }}
        >
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Pending Offers Section */}
      <div>
        <h2 style={{ fontSize: '1.35rem', color: 'var(--brand-navy)', marginBottom: '1rem' }}>Active Pending Offers</h2>

        {loading ? (
          <LoadingSpinner message="Checking broadcast queue..." />
        ) : pendingOffers.length === 0 ? (
          <EmptyState
            title="No pending offers right now"
            description="You will be notified here as soon as a customer requests a service in your radius."
            icon={Clock}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {pendingOffers.map((offer) => (
              <div
                key={offer.id}
                className="card card-interactive"
                style={{
                  borderLeft: '5px solid var(--warning)',
                  padding: '1.75rem'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '0.85rem'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--brand-blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Offer #{offer.id} &bull; Round {offer.dispatch_round}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', marginTop: '0.2rem', color: 'var(--brand-navy)', margin: 0 }}>
                      {offer.service_name || 'Service Job'}
                    </h3>
                  </div>
                  <CountdownTimer expiresAt={offer.expires_at} onExpire={loadOffers} />
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                  {offer.problem_description}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '1rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MapPin size={15} style={{ color: 'var(--brand-blue)' }} />
                    <span>{offer.service_city || 'Coimbatore'} (within your 5 km radius)</span>
                  </div>
                  <div>
                    <span>Broadcasted: {new Date(offer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'flex-end',
                    marginTop: '1.25rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <button
                    onClick={() => handleRejectOffer(offer.id)}
                    className="btn btn-secondary btn-sm"
                    disabled={actionLoading}
                  >
                    <XCircle size={15} /> Decline
                  </button>
                  <button
                    onClick={() => handleAcceptOffer(offer.id)}
                    className="btn btn-primary"
                    disabled={actionLoading}
                  >
                    <CheckCircle size={16} /> Accept &amp; Win Assignment
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past / Resolved Offers */}
      {pastOffers.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--brand-navy)', marginBottom: '1rem' }}>Past Offers History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pastOffers.slice(0, 10).map((offer) => (
              <div
                key={offer.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem',
                  fontSize: '0.9rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <strong style={{ color: 'var(--brand-navy)' }}>{offer.service_name || 'Job'}</strong>
                    <StatusBadge status={offer.status} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Round {offer.dispatch_round} &bull; {new Date(offer.created_at).toLocaleDateString()}
                  </span>
                </div>

                {offer.status === 'ACCEPTED' && (
                  <button
                    onClick={() => navigate(`/worker/jobs/${offer.booking_id}`)}
                    className="btn btn-secondary btn-sm"
                  >
                    View Job <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
