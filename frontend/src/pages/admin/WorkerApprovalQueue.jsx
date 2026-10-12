import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, XCircle, Search, User, MapPin } from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

export default function WorkerApprovalQueue() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  useEffect(() => {
    loadWorkers();
  }, [statusFilter]);

  const loadWorkers = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = statusFilter === 'ALL'
        ? '/api/auth/admin/workers/'
        : `/api/auth/admin/workers/?status=${statusFilter}`;
      const data = await api.get(endpoint);
      const list = Array.isArray(data) ? data : (data.results || []);
      setWorkers(list);
    } catch (err) {
      setError(err.message || 'Failed to load worker verification queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async (workerId, newStatus) => {
    let reason = '';
    if (newStatus === 'REJECTED') {
      reason = window.prompt('Enter reason for rejecting this worker profile:');
      if (reason === null) return;
    }

    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/auth/admin/workers/${workerId}/approval/`, {
        approval_status: newStatus,
        approval_reason: reason || 'Verified by admin'
      });
      setSuccessMsg(`Worker profile ${newStatus.toLowerCase()} successfully.`);
      loadWorkers();
    } catch (err) {
      setError(err.message || 'Failed to update worker approval status.');
    } finally {
      setActionLoading(false);
    }
  };

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
            <span>Home 2 Service Administration</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
            Worker Verification Queue
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Review, verify credentials, and approve registered service professionals before dispatch eligibility
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} retryAction={loadWorkers} />

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

      {loading ? (
        <LoadingSpinner message="Loading worker verification queue..." />
      ) : workers.length === 0 ? (
        <EmptyState
          title={`No ${statusFilter.toLowerCase()} workers found`}
          description="There are currently no worker profiles matching this verification filter."
          icon={ShieldCheck}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {workers.map((w) => (
            <div
              key={w.id}
              className="card card-interactive"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem',
                padding: '1.5rem',
                borderLeft: w.approval_status === 'APPROVED' ? '5px solid var(--success)' : w.approval_status === 'REJECTED' ? '5px solid var(--danger)' : '5px solid var(--warning)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy)', margin: 0 }}>
                    {w.business_name || w.username || 'Professional'}
                  </h3>
                  <StatusBadge status={w.approval_status} />
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 0.35rem' }}>
                  Username: <strong style={{ color: 'var(--brand-navy)' }}>{w.username}</strong> &bull; Experience: {w.experience_years} years &bull; ID: {w.id_number || 'N/A'}
                </p>

                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                  <MapPin size={13} style={{ display: 'inline', marginRight: '3px', color: 'var(--brand-blue)' }} />
                  Coordinates: {w.latitude}, {w.longitude} &bull; Service Radius: {w.service_radius_km} km
                </p>

                {w.approval_reason && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--warning)', marginTop: '0.35rem', margin: 0 }}>
                    Verification Note: {w.approval_reason}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                {w.approval_status !== 'APPROVED' && (
                  <button
                    onClick={() => handleApprovalAction(w.id, 'APPROVED')}
                    className="btn btn-primary btn-sm"
                    disabled={actionLoading}
                  >
                    <CheckCircle size={15} /> Approve Worker
                  </button>
                )}

                {w.approval_status !== 'REJECTED' && (
                  <button
                    onClick={() => handleApprovalAction(w.id, 'REJECTED')}
                    className="btn btn-danger btn-sm"
                    disabled={actionLoading}
                  >
                    <XCircle size={15} /> Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
