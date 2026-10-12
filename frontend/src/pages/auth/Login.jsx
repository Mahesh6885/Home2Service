import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ErrorMessage';
import { getSafeRedirectPath, getRoleDashboard } from '../../utils/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, role, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  // If already authenticated (e.g. via active session or pressing Back into login), redirect to role dashboard
  if (!authLoading && isAuthenticated) {
    return <Navigate to={getRoleDashboard(role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      const targetPath = getSafeRedirectPath(from, user.role);
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '460px', margin: '2.5rem auto 0', width: '100%' }}>
      <div className="card" style={{ padding: '2.5rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="/assets/home-2-service-logo.png"
            alt="Home 2 Service"
            style={{
              height: '60px',
              width: 'auto',
              objectFit: 'contain',
              margin: '0 auto 0.75rem',
              display: 'block'
            }}
          />
          <h2 style={{ fontSize: '1.6rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>Welcome Back</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            Sign in to access your Home 2 Service account
          </p>
        </div>

        <ErrorMessage message={error} onDismiss={() => setError('')} />

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username or Phone</label>
            <div style={{ position: 'relative' }}>
              <input
                id="username"
                type="text"
                className="form-control"
                placeholder="e.g. mahesh or +919876543210"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
            New to Home 2 Service?{' '}
            <Link to="/register" style={{ color: 'var(--brand-blue)', fontWeight: 700 }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
