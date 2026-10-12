import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { User, Briefcase, ArrowRight, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ErrorMessage';
import { getRoleDashboard } from '../../utils/navigation';

const COIMBATORE_AREAS = [
  { name: 'Gandhipuram (Central)', lat: 11.0168, lon: 76.9558 },
  { name: 'RS Puram (West)', lat: 11.0085, lon: 76.9450 },
  { name: 'Peelamedu (East / IT)', lat: 11.0250, lon: 76.9950 },
  { name: 'Saibaba Colony (North)', lat: 11.0300, lon: 76.9400 },
  { name: 'Singanallur (South-East)', lat: 10.9980, lon: 77.0200 },
];

export default function Register() {
  const [roleType, setRoleType] = useState('CUSTOMER'); // 'CUSTOMER' or 'WORKER'
  const [formData, setFormData] = useState({
    username: '',
    phone_number: '+91',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password_confirm: '',
    // Worker specific
    business_name: '',
    experience_years: 2,
    id_number: '',
    latitude: 11.0168,
    longitude: 76.9558,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { registerCustomer, registerWorker, role, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect to role dashboard immediately
  if (!authLoading && isAuthenticated) {
    return <Navigate to={getRoleDashboard(role)} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAreaSelect = (area) => {
    setFormData((prev) => ({
      ...prev,
      latitude: area.lat,
      longitude: area.lon
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (!formData.phone_number.startsWith('+91') || formData.phone_number.length < 13) {
      setError('Phone number must be a valid 10-digit Indian number starting with +91 (e.g. +919876543210).');
      return;
    }

    setLoading(true);

    try {
      if (roleType === 'CUSTOMER') {
        await registerCustomer({
          username: formData.username,
          phone_number: formData.phone_number,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          password_confirm: formData.password_confirm
        });
        navigate('/customer/dashboard', { replace: true });
      } else {
        await registerWorker({
          username: formData.username,
          phone_number: formData.phone_number,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          password_confirm: formData.password_confirm,
          business_name: formData.business_name || `${formData.username} Services`,
          experience_years: parseInt(formData.experience_years, 10) || 1,
          id_number: formData.id_number || 'TN-CBE-ID',
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude)
        });
        navigate('/worker/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '580px', margin: '2rem auto 0', width: '100%' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <img
            src="/assets/home-2-service-logo.png"
            alt="Home 2 Service"
            style={{
              height: '56px',
              width: 'auto',
              objectFit: 'contain',
              margin: '0 auto 0.75rem',
              display: 'block'
            }}
          />
          <h2 style={{ fontSize: '1.6rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>Join Home 2 Service</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Local Services Platform for Coimbatore, Tamil Nadu
          </p>
        </div>

        {/* Role Toggle Switch */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--bg-main)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.75rem',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <button
            type="button"
            onClick={() => setRoleType('CUSTOMER')}
            style={{
              padding: '0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: roleType === 'CUSTOMER' ? 'var(--primary)' : 'transparent',
              color: roleType === 'CUSTOMER' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all var(--transition-fast)'
            }}
          >
            <User size={16} /> Need Services
          </button>
          <button
            type="button"
            onClick={() => setRoleType('WORKER')}
            style={{
              padding: '0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: roleType === 'WORKER' ? 'var(--primary)' : 'transparent',
              color: roleType === 'WORKER' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Briefcase size={16} /> Service Professional
          </button>
        </div>

        <ErrorMessage message={error} onDismiss={() => setError('')} />

        <form onSubmit={handleSubmit}>
          <div className="grid-2" style={{ gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username *</label>
              <input
                id="username"
                name="username"
                type="text"
                className="form-control"
                placeholder="e.g. mahesh_cbe"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone_number">Phone (+91) *</label>
              <input
                id="phone_number"
                name="phone_number"
                type="text"
                className="form-control"
                placeholder="+919876543210"
                value={formData.phone_number}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="grid-2" style={{ gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="first_name">First Name</label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                className="form-control"
                placeholder="Mahesh"
                value={formData.first_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="last_name">Last Name</label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                className="form-control"
                placeholder="K"
                value={formData.last_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-control"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="grid-2" style={{ gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password *</label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-control"
                placeholder="Min 8 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password_confirm">Confirm Password *</label>
              <input
                id="password_confirm"
                name="password_confirm"
                type="password"
                className="form-control"
                placeholder="Min 8 characters"
                value={formData.password_confirm}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Worker Specific Fields */}
          {roleType === 'WORKER' && (
            <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.85rem', color: 'var(--primary)' }}>
                Professional Details
              </h4>

              <div className="form-group">
                <label className="form-label" htmlFor="business_name">Business or Trade Name</label>
                <input
                  id="business_name"
                  name="business_name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Coimbatore Rapid Electricals"
                  value={formData.business_name}
                  onChange={handleChange}
                />
              </div>

              <div className="grid-2" style={{ gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="experience_years">Experience (Years)</label>
                  <input
                    id="experience_years"
                    name="experience_years"
                    type="number"
                    min="1"
                    max="50"
                    className="form-control"
                    value={formData.experience_years}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="id_number">Govt ID / License #</label>
                  <input
                    id="id_number"
                    name="id_number"
                    type="text"
                    className="form-control"
                    placeholder="Aadhaar / Trade Lic"
                    value={formData.id_number}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <MapPin size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--accent)' }} />
                  Operating Base Location in Coimbatore
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                  {COIMBATORE_AREAS.map((area) => (
                    <button
                      key={area.name}
                      type="button"
                      onClick={() => handleAreaSelect(area)}
                      className={`btn btn-sm ${
                        formData.latitude === area.lat && formData.longitude === area.lon
                          ? 'btn-teal'
                          : 'btn-secondary'
                      }`}
                      style={{ fontSize: '0.775rem' }}
                    >
                      {area.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : `Register as ${roleType === 'WORKER' ? 'Service Professional' : 'Customer'}`} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--brand-blue)', fontWeight: 700 }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
