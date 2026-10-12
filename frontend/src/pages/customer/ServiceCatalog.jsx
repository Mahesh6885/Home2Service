import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Wrench, ArrowRight, X, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';

export default function ServiceCatalog() {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const [catsData, servsData] = await Promise.all([
        api.get('/api/services/categories/'),
        api.get('/api/services/catalog/')
      ]);
      const catList = Array.isArray(catsData) ? catsData : (catsData?.results || []);
      const srvList = Array.isArray(servsData) ? servsData : (servsData?.results || []);
      setCategories(catList);
      setServices(srvList);
    } catch (err) {
      setError(err.message || 'Failed to load service catalog.');
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter((srv) => {
    const matchesCategory = selectedCategory ? srv.category === selectedCategory : true;
    const matchesSearch = searchQuery
      ? srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (srv.description && srv.description.toLowerCase().includes(searchQuery.toLowerCase()))
      : true;
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-blue)', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
          <span>Home 2 Service Verified Catalog</span>
        </div>
        <h1 style={{ fontSize: '2.2rem', color: 'var(--brand-navy)', marginBottom: '0.5rem' }}>
          Explore Local Services in Coimbatore
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Transparent, verified local plumbers, electricians, appliance mechanics, and carpenters
        </p>

        {/* Search Bar */}
        <div style={{ maxWidth: '560px', margin: '1.75rem auto 0', position: 'relative' }}>
          <Search
            size={18}
            style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            className="form-control"
            placeholder="Search services (e.g. Pipe Leak, AC Repair, Electrical Wiring)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '48px', paddingRight: searchQuery ? '44px' : '18px', borderRadius: 'var(--radius-full)', height: '48px', fontSize: '0.95rem', boxShadow: 'var(--shadow-sm)' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px'
              }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <ErrorMessage message={error} retryAction={loadCatalog} />

      {/* Category Filter Pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.6rem',
          justifyContent: 'center'
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`btn btn-sm ${selectedCategory === null ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-full)', padding: '0.45rem 1.1rem' }}
        >
          All Categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`btn btn-sm ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.45rem 1.1rem' }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Services Grid */}
      {loading ? (
        <LoadingSpinner message="Loading services in Coimbatore..." />
      ) : filteredServices.length === 0 ? (
        <EmptyState
          title="No matching services found"
          description="Try clearing your search query or choosing another category."
          icon={Wrench}
          actionText="Clear Filters"
          onAction={() => {
            setSelectedCategory(null);
            setSearchQuery('');
          }}
        />
      ) : (
        <div className="grid-3" style={{ gap: '1.5rem' }}>
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="card card-interactive"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.75rem',
                gap: '1.25rem'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span className="badge badge-info" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {service.category_name || 'Service'}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                    ₹{service.base_price} base
                  </span>
                </div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--brand-navy)', marginBottom: '0.45rem' }}>
                  {service.name}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                  {service.description || 'Professional on-demand inspection, diagnosis, and repair by certified pros.'}
                </p>
              </div>

              <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  5 km Dispatch Radius
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate(`/customer/book?service=${service.id}`)}
                >
                  Book Service <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
