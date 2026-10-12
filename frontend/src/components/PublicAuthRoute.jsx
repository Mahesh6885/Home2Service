import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { getRoleDashboard } from '../utils/navigation';

/**
 * Route wrapper for public authentication pages (/login, /register).
 * If a user is already authenticated (or navigates back into auth pages),
 * they are automatically redirected to their role-specific dashboard with history replacement.
 */
export default function PublicAuthRoute({ children }) {
  const { role, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage message="Verifying session..." />;
  }

  if (isAuthenticated) {
    const dashboardPath = getRoleDashboard(role);
    return <Navigate to={dashboardPath} replace />;
  }

  return children;
}
