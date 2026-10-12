import React, { useState, useEffect } from 'react';
import { Layers, Plus, CheckCircle, X, Wrench } from 'lucide-react';
import { api } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';

export default function AdminCatalog() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [showSrvModal, setShowSrvModal] = useState(false);
  const [srvCatId, setSrvCatId] = useState('');
  const [srvName, setSrvName] = useState('');
  const [srvDesc, setSrvDesc] = useState('');

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const [catsData, srvsData] = await Promise.all([
        api.get('/api/services/categories/'),
        api.get('/api/services/catalog/')
      ]);
      const catList = Array.isArray(catsData) ? catsData : (catsData?.results || []);
      const srvList = Array.isArray(srvsData) ? srvsData : (srvsData?.results || []);
      setCategories(catList);
      setServices(srvList);
      if (catList.length > 0) {
        setSrvCatId(catList[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post('/api/admin/services/categories/', {
        name: catName,
        description: catDesc,
        is_active: true
      });
      setShowCatModal(false);
      setCatName('');
      setCatDesc('');
      setSuccessMsg('Category created successfully.');
      loadCatalog();
    } catch (err) {
      setError(err.message || 'Failed to create category.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    if (!srvName.trim() || !srvCatId) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post('/api/admin/services/catalog/', {
        category: srvCatId,
        name: srvName,
        description: srvDesc,
        is_active: true
      });
      setShowSrvModal(false);
      setSrvName('');
      setSrvDesc('');
      setSuccessMsg('Service created successfully.');
      loadCatalog();
    } catch (err) {
      setError(err.message || 'Failed to create service.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleService = async (srvId, currentStatus) => {
    setActionLoading(true);
    setError('');
    try {
      await api.patch(`/api/admin/services/catalog/${srvId}/`, {
        is_active: !currentStatus
      });
      setSuccessMsg(`Service ${!currentStatus ? 'activated' : 'deactivated'}.`);
      loadCatalog();
    } catch (err) {
      setError(err.message || 'Failed to update service status.');
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
            Service Catalog Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: 0 }}>
            Configure active service categories and marketplace services for Coimbatore
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowCatModal(true)} className="btn btn-secondary">
            <Plus size={16} /> New Category
          </button>
          <button onClick={() => setShowSrvModal(true)} className="btn btn-primary">
            <Plus size={16} /> New Service
          </button>
        </div>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} retryAction={loadCatalog} />

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
        <LoadingSpinner message="Loading catalog data..." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Categories Summary */}
          <div>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem', color: 'var(--brand-navy)' }}>
              Active Categories ({categories.length})
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="card"
                  style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem' }}
                >
                  <strong style={{ fontSize: '0.95rem', color: 'var(--brand-navy)' }}>{cat.name}</strong>
                  <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>Active</span>
                </div>
              ))}
            </div>
          </div>

          {/* Services List */}
          <div>
            <h2 style={{ fontSize: '1.35rem', marginBottom: '1rem', color: 'var(--brand-navy)' }}>
              Marketplace Services ({services.length})
            </h2>
            <div className="grid-2" style={{ gap: '1.25rem' }}>
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="card card-interactive"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.5rem',
                    borderLeft: srv.is_active ? '5px solid var(--brand-blue)' : '5px solid var(--border-medium)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                      <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy)' }}>{srv.name}</h3>
                      <span className={`badge ${srv.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {srv.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--brand-blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Category: {srv.category_name}
                    </span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5, margin: '0.5rem 0 0' }}>
                      {srv.description || 'Standard service catalog offering.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.85rem', marginTop: '1.25rem' }}>
                    <button
                      onClick={() => handleToggleService(srv.id, srv.is_active)}
                      className="btn btn-secondary btn-sm"
                      disabled={actionLoading}
                    >
                      {srv.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCatModal && (
        <div className="modal-backdrop" onClick={() => setShowCatModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ color: 'var(--brand-navy)', margin: 0 }}>Add New Service Category</h3>
              <button onClick={() => setShowCatModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Carpentry & Woodwork"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Scope of services..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Service Modal */}
      {showSrvModal && (
        <div className="modal-backdrop" onClick={() => setShowSrvModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ color: 'var(--brand-navy)', margin: 0 }}>Add New Service to Catalog</h3>
              <button onClick={() => setShowSrvModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateService}>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-control"
                  value={srvCatId}
                  onChange={(e) => setSrvCatId(e.target.value)}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Service Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Kitchen Chimney Deep Clean"
                  value={srvName}
                  onChange={(e) => setSrvName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Details and coverage..."
                  value={srvDesc}
                  onChange={(e) => setSrvDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSrvModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating...' : 'Create Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
