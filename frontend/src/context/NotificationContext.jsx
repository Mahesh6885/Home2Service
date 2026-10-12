import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollingRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await api.get('/api/notifications/unread-count/');
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Quiet fail on polling errors
    }
  }, [isAuthenticated]);

  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!isAuthenticated) return [];
    setLoading(true);
    try {
      const endpoint = unreadOnly ? '/api/notifications/?unread=true' : '/api/notifications/';
      const data = await api.get(endpoint);
      const list = data.results || (Array.isArray(data) ? data : []);
      setNotifications(list);
      return list;
    } catch (err) {
      console.warn('Could not load notifications:', err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const markAsRead = async (id) => {
    try {
      const res = await api.post(`/api/notifications/${id}/read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: res.notification?.read_at } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      return true;
    } catch (err) {
      console.error('Error marking read:', err.message);
      return false;
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/api/notifications/read-all/');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      return true;
    } catch (err) {
      console.error('Error marking all read:', err.message);
      return false;
    }
  };

  // Manage modest 30-second polling for unread count
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    // Immediate initial fetch
    fetchUnreadCount();

    // 30-second gentle interval
    pollingRef.current = setInterval(() => {
      // Only poll when document is visible
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    }, 30000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isAuthenticated, fetchUnreadCount]);

  const value = {
    unreadCount,
    notifications,
    loading,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
