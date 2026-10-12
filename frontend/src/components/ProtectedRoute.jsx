import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { getRoleDashboard } from '../utils/navigation';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { role, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSpinner fullPage message="Authenticating session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const dashboardPath = getRoleDashboard(role);
    return (
      <div style={{ textAlign: 'center', padding: '4.5rem 1.5rem', maxWidth: '500px', margin: '0 auto' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}
        >
          <ShieldAlert size={28} />
        </div>
        <h2 style={{ color: 'var(--brand-navy)', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
          Access Restricted
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', fontSize: '0.925rem', lineHeight: 1.5 }}>
          {`Your current account role (${role || 'User'}) does not have permission to view this page.`}
        </p>
        <button
          onClick={() => navigate(dashboardPath, { replace: true })}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}
        >
          Go to My Dashboard <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  return children;
}
