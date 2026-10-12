import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setStoredTokens, clearStoredTokens, getStoredTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('mw_user_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
      setAuthError('Your session has expired. Please sign in again.');
    };

    window.addEventListener('mw:auth_expired', handleAuthExpired);

    // Verify authentication and refresh user profile if tokens exist
    const { access } = getStoredTokens();
    if (access) {
      refreshProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => window.removeEventListener('mw:auth_expired', handleAuthExpired);
  }, []);

  const refreshProfile = async () => {
    try {
      const profileData = await api.get('/api/auth/profile/');
      const updatedUser = {
        ...user,
        ...profileData,
      };
      setUser(updatedUser);
      localStorage.setItem('mw_user_data', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      console.warn('Could not refresh profile:', err.message);
      return null;
    }
  };

  const login = async (username, password) => {
    setAuthError(null);
    try {
      const data = await api.post('/api/auth/login/', { username, password });
      setStoredTokens(data.access, data.refresh);

      const userData = {
        ...data.user,
        worker_profile: data.worker_profile || null,
      };
      setUser(userData);
      localStorage.setItem('mw_user_data', JSON.stringify(userData));
      return userData;
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const registerCustomer = async (formData) => {
    setAuthError(null);
    try {
      await api.post('/api/auth/register/customer/', formData);
      return await login(formData.username, formData.password);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const registerWorker = async (formData) => {
    setAuthError(null);
    try {
      await api.post('/api/auth/register/worker/', formData);
      return await login(formData.username, formData.password);
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      const { refresh } = getStoredTokens();
      if (refresh) {
        await api.post('/api/auth/logout/', { refresh }).catch(() => {});
      }
    } finally {
      clearStoredTokens();
      setUser(null);
      setIdleWarning(false);
    }
  };

  const [idleWarning, setIdleWarning] = useState(false);

  // Application-level idle session detection
  useEffect(() => {
    if (!user) return;

    let warningTimer;
    let expiryTimer;
    const IDLE_WARN_MS = 30 * 60 * 1000; // 30 minutes
    const IDLE_EXPIRE_MS = 45 * 60 * 1000; // 45 minutes

    const resetTimers = () => {
      setIdleWarning(false);
      clearTimeout(warningTimer);
      clearTimeout(expiryTimer);

      warningTimer = setTimeout(() => {
        setIdleWarning(true);
      }, IDLE_WARN_MS);

      expiryTimer = setTimeout(() => {
        logout();
        setAuthError('Session expired due to inactivity. Please sign in again.');
      }, IDLE_EXPIRE_MS);
    };

    const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimers, { passive: true }));
    resetTimers();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(expiryTimer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimers));
    };
  }, [user]);

  const extendSession = () => {
    setIdleWarning(false);
    refreshProfile();
  };

  const value = {
    user,
    role: user?.role || null,
    workerProfile: user?.worker_profile || null,
    isAuthenticated: !!user,
    loading,
    authError,
    setAuthError,
    idleWarning,
    extendSession,
    login,
    registerCustomer,
    registerWorker,
    logout,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
