import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Briefcase, 
  Clock, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  ToggleLeft, 
  ToggleRight, 
  ArrowRight,
  ShieldAlert,
  Wrench,
  MapPin
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import CountdownTimer from '../../components/CountdownTimer';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import LocationSharingControl from '../../components/map/LocationSharingControl';

export default function WorkerDashboard() {
  const { user, workerProfile, refreshProfile } = useAuth();
  const [offers, setOffers] = useState([]);
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    loadWorkerData();
  }, []);

  const loadWorkerData = async () => {
    setLoading(true);
    setError('');
    try {
      const [offersData, profileData] = await Promise.all([
        api.get('/api/workers/me/offers/').catch(() => []),
        refreshProfile()
      ]);

      const offerList = Array.isArray(offersData) ? offersData : (offersData.results || []);
      setOffers(offerList);

      // Filter accepted jobs
      const activeOffers = offerList.filter((o) => o.status === 'ACCEPTED');
      setAssignedJobs(activeOffers);
    } catch (err) {
      setError(err.message || 'Failed to load worker dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAvailability = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post('/api/auth/worker/toggle-availability/');
      await refreshProfile();
      setSuccessMsg(res.message || 'Availability updated.');
    } catch (err) {
      setError(err.message || 'Failed to update availability.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingOffers = offers.filter((o) => o.status === 'PENDING');
  const isApproved = workerProfile?.approval_status === 'APPROVED';
  const isAvailable = workerProfile?.is_available;

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome Banner */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className={`badge ${isApproved ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {isApproved ? 'Verified Service Professional' : 'Verification Under Review'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
            {workerProfile?.business_name || user?.username}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Home 2 Service Professional Portal &bull; Coimbatore Dispatch Hub
          </p>
        </div>

        {/* Availability Toggle Switch */}
        {isApproved && (
          <button
            onClick={handleToggleAvailability}
            disabled={actionLoading}
            className={`btn ${isAvailable ? 'btn-primary' : 'btn-secondary'} btn-lg`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}
          >
            {isAvailable ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            <span>{isAvailable ? 'Online (Accepting Jobs)' : 'Offline (Paused)'}</span>
          </button>
        )}
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

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

      {/* GPS Location Sharing & Dispatch Tracking */}
      {isApproved && (
        <LocationSharingControl
          isAvailableForDispatch={isAvailable}
          onStatusChange={() => refreshProfile()}
        />
      )}

      {/* Verification State Banner */}
      {!isApproved && (
        <div
          className="card"
          style={{
            background: 'var(--warning-bg)',
            borderColor: 'var(--warning-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem',
            padding: '1.5rem'
          }}
        >
          <ShieldAlert size={26} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h3 style={{ color: 'var(--brand-navy)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.35rem' }}>
              Account Verification Pending
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
              Your profile is currently under review by Home 2 Service administrators in Coimbatore. You will receive broadcast offers and be eligible to win jobs as soon as your ID and qualifications are approved.
            </p>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid-3" style={{ gap: '1.25rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--warning-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning)',
              flexShrink: 0
            }}
          >
            <Clock size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Offers
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: '2px' }}>
              {pendingOffers.length}
            </div>
          </div>
        </div>

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
            <Briefcase size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Assigned Jobs
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: '2px' }}>
              {assignedJobs.length}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-navy)',
              flexShrink: 0
            }}
          >
            <Layers size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Dispatch Radius
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-navy)', marginTop: '2px' }}>
              {workerProfile?.service_radius_km || 5.0} km
            </div>
          </div>
        </div>
      </div>

      {/* Pending Broadcast Offers Section */}
      <div>
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--brand-navy)' }}>Live Broadcast Job Offers</h2>
          <Link to="/worker/offers" style={{ color: 'var(--brand-blue)', fontSize: '0.875rem', fontWeight: 700 }}>
            View all broadcasts &rarr;
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner message="Checking for broadcast offers in your radius..." />
        ) : pendingOffers.length === 0 ? (
          <EmptyState
            title="No pending offers right now"
            description={
              !isAvailable
                ? 'You are currently offline. Switch your availability to Online to receive broadcast offers.'
                : 'When nearby customers in Coimbatore request your services, broadcast offers will appear here.'
            }
            icon={Clock}
            actionText="Manage My Services"
            onAction={() => navigate('/worker/services')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingOffers.map((offer) => (
              <div
                key={offer.id}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                  padding: '1.5rem',
                  borderLeft: '5px solid var(--warning)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy)', margin: 0 }}>
                      {offer.service_name || 'Service Job'}
                    </h3>
                    <CountdownTimer expiresAt={offer.expires_at} onExpire={loadWorkerData} />
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.45, maxWidth: '640px' }}>
                    {offer.problem_description}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                    <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} />
                    Approximate Location: {offer.service_city || 'Coimbatore'} (within your 5 km radius)
                  </p>
                </div>

                <button
                  onClick={() => navigate('/worker/offers')}
                  className="btn btn-primary btn-sm"
                >
                  Review &amp; Accept <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
