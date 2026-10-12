import React, { useState, useEffect } from 'react';
import { Layers, Plus, Trash2, CheckCircle, X, Wrench, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

export default function WorkerServices() {
  const { user, workerProfile } = useAuth();
  const [workerServices, setWorkerServices] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Service Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customRate, setCustomRate] = useState('350.00');
  const [experienceYears, setExperienceYears] = useState(2);

  const isApproved = workerProfile?.approval_status === 'APPROVED';

  useEffect(() => {
    loadServicesData();
  }, []);

  const loadServicesData = async () => {
    setLoading(true);
    setError('');
    try {
      const [workerSrvs, catalogSrvs] = await Promise.all([
        api.get('/api/workers/me/services/').catch((err) => {
          // If pending worker gets 403, return empty array gracefully
          if (err.message?.includes('approved') || err.message?.includes('403')) {
            return [];
          }
          throw err;
        }),
        api.get('/api/services/catalog/')
      ]);

      const myServices = Array.isArray(workerSrvs) ? workerSrvs : (workerSrvs?.results || []);
      const allCatalog = Array.isArray(catalogSrvs) ? catalogSrvs : (catalogSrvs?.results || []);

      setWorkerServices(myServices);
      setCatalogServices(allCatalog);

      // Auto-select first service that is not already added
      const existingIds = new Set(
        myServices.map((ws) => ws.service_id || ws.service_details?.id || ws.service)
      );
      const available = allCatalog.filter((s) => !existingIds.has(s.id));
      if (available.length > 0) {
        setSelectedServiceId(String(available[0].id));
      } else if (allCatalog.length > 0) {
        setSelectedServiceId(String(allCatalog[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load services.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    const existingIds = new Set(
      workerServices.map((ws) => ws.service_id || ws.service_details?.id || ws.service)
    );
    const available = catalogServices.filter((s) => !existingIds.has(s.id));
    if (available.length > 0) {
      setSelectedServiceId(String(available[0].id));
    } else if (catalogServices.length > 0) {
      setSelectedServiceId(String(catalogServices[0].id));
    }
    setError('');
    setShowAddModal(true);
  };

  const handleAddService = async (e) => {
    e.preventDefault();
    if (!selectedServiceId) {
      setError('Please select a service from the catalog.');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await api.post('/api/workers/me/services/', {
        service_id: parseInt(selectedServiceId, 10),
        inspection_fee: parseFloat(customRate) || 0,
        experience_years: parseInt(experienceYears, 10) || 1,
        is_active: true
      });
      setShowAddModal(false);
      setSuccessMsg('Service offering added successfully.');
      loadServicesData();
    } catch (err) {
      setError(err.message || 'Failed to add service offering.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (offeringId, currentStatus) => {
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/api/workers/me/services/${offeringId}/`, {
        is_active: !currentStatus
      });
      setSuccessMsg(`Service ${!currentStatus ? 'activated' : 'deactivated'}.`);
      loadServicesData();
    } catch (err) {
      setError(err.message || 'Failed to update service status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOffering = async (offeringId) => {
    if (!window.confirm('Are you sure you want to remove this service from your offerings?')) return;
    setActionLoading(true);
    setError('');
    try {
      const res = await api.delete(`/api/workers/me/services/${offeringId}/`);
      setWorkerServices((prev) => prev.filter((ws) => ws.id !== offeringId));
      setSuccessMsg(res?.message || 'Service offering removed successfully.');
      loadServicesData();
    } catch (err) {
      setError(err.message || 'Failed to delete service offering.');
    } finally {
      setActionLoading(false);
    }
  };

  const existingIds = new Set(
    workerServices.map((ws) => ws.service_id || ws.service_details?.id || ws.service)
  );

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
            <span>Professional Skills &amp; Rate Card</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
            My Service Offerings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Configure the types of services you provide to receive matching broadcast offers in Coimbatore
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="btn btn-primary"
          disabled={!isApproved}
          title={!isApproved ? 'Admin approval required' : 'Add Service'}
        >
          <Plus size={16} /> Add Service Offering
        </button>
      </div>

      {/* Pending Approval Notice */}
      {!isApproved && (
        <div
          className="card"
          style={{
            background: 'var(--warning-bg)',
            borderColor: 'var(--warning-border)',
            padding: '1.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <AlertTriangle size={24} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div>
              <strong style={{ color: 'var(--brand-navy)', fontSize: '1rem' }}>
                Account Pending Administrator Approval
              </strong>
              <p style={{ fontSize: '0.875rem', marginTop: '0.35rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Your worker account is currently in <strong>{workerProfile?.approval_status || 'PENDING'}</strong> status. An administrator must approve your profile at <strong>/admin/workers</strong> before you can add service offerings or receive job broadcasts.
              </p>
            </div>
          </div>
        </div>
      )}

      <ErrorMessage message={error} onDismiss={() => setError('')} retryAction={loadServicesData} />

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
        <LoadingSpinner message="Loading your configured services..." />
      ) : workerServices.length === 0 ? (
        <EmptyState
          title="No services configured"
          description={
            isApproved
              ? "You haven't added any services yet. Click 'Add Service Offering' to select services from the Coimbatore catalog."
              : "Your account is awaiting admin approval. Once approved, you can add service offerings here."
          }
          icon={Layers}
          actionText={isApproved ? "Add a Service" : undefined}
          onAction={isApproved ? handleOpenAddModal : undefined}
        />
      ) : (
        <div className="grid-2" style={{ gap: '1.25rem' }}>
          {workerServices.map((ws) => {
            const srvName = ws.service_details?.name || ws.service_name || 'Service';
            const catName = ws.service_details?.category_name || ws.service_category_name || 'General Category';
            const fee = ws.inspection_fee != null ? ws.inspection_fee : (ws.custom_rate || '0.00');

            return (
              <div
                key={ws.id}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.5rem',
                  borderLeft: ws.is_active ? '5px solid var(--brand-blue)' : '5px solid var(--border-medium)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy)' }}>{srvName}</h3>
                    <span className={`badge ${ws.is_active ? 'badge-success' : 'badge-neutral'}`}>
                      {ws.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {catName}
                  </p>
                  <div style={{ marginTop: '1rem', fontSize: '0.9rem', background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                    <p style={{ margin: '0 0 4px 0' }}><strong style={{ color: 'var(--brand-navy)' }}>Inspection / Base Fee:</strong> ₹{fee}</p>
                    <p style={{ margin: 0 }}><strong style={{ color: 'var(--brand-navy)' }}>Experience:</strong> {ws.experience_years} years</p>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    borderTop: '1px solid var(--border-subtle)',
                    paddingTop: '1rem',
                    marginTop: '1.25rem'
                  }}
                >
                  <button
                    onClick={() => handleToggleActive(ws.id, ws.is_active)}
                    className="btn btn-secondary btn-sm"
                    disabled={actionLoading}
                  >
                    {ws.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteOffering(ws.id)}
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)' }}
                    disabled={actionLoading}
                    title="Remove offering"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Service Offering Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ color: 'var(--brand-navy)', margin: 0 }}>Add Service Offering</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddService}>
              <div className="form-group">
                <label className="form-label">Select Service *</label>
                <select
                  className="form-control"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                >
                  {catalogServices.map((cs) => {
                    const isAlreadyAdded = existingIds.has(cs.id);
                    return (
                      <option key={cs.id} value={cs.id} disabled={isAlreadyAdded}>
                        {cs.category_name ? `${cs.category_name} — ` : ''}{cs.name} {isAlreadyAdded ? '(Already added)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid-2" style={{ gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Inspection / Base Fee (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Experience (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="form-control"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Add to My Offerings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
