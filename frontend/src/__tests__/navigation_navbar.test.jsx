import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PublicAuthRoute from '../components/PublicAuthRoute';
import ProtectedRoute from '../components/ProtectedRoute';
import * as AuthContextModule from '../context/AuthContext';
import * as NotificationContextModule from '../context/NotificationContext';
import { getRoleDashboard, getSafeRedirectPath } from '../utils/navigation';

describe('Navigation Helpers & Safe Redirects', () => {
  it('maps roles to their respective dashboards', () => {
    expect(getRoleDashboard('CUSTOMER')).toBe('/customer/dashboard');
    expect(getRoleDashboard('WORKER')).toBe('/worker/dashboard');
    expect(getRoleDashboard('ADMIN')).toBe('/admin/workers');
    expect(getRoleDashboard('UNKNOWN')).toBe('/');
    expect(getRoleDashboard(null)).toBe('/');
  });

  it('validates safe internal redirect paths', () => {
    // Valid customer paths
    expect(getSafeRedirectPath('/customer/bookings', 'CUSTOMER')).toBe('/customer/bookings');
    expect(getSafeRedirectPath('/services', 'CUSTOMER')).toBe('/services');
    expect(getSafeRedirectPath('/customer/dashboard', 'CUSTOMER')).toBe('/customer/dashboard');

    // Valid worker paths
    expect(getSafeRedirectPath('/worker/offers', 'WORKER')).toBe('/worker/offers');
    expect(getSafeRedirectPath('/worker/jobs/123', 'WORKER')).toBe('/worker/jobs/123');

    // Valid admin paths
    expect(getSafeRedirectPath('/admin/catalog', 'ADMIN')).toBe('/admin/catalog');
    expect(getSafeRedirectPath('/admin/bookings', 'ADMIN')).toBe('/admin/bookings');

    // Reject cross-role or unauthorized destinations
    expect(getSafeRedirectPath('/worker/dashboard', 'CUSTOMER')).toBe('/customer/dashboard');
    expect(getSafeRedirectPath('/admin/workers', 'WORKER')).toBe('/worker/dashboard');
    expect(getSafeRedirectPath('/customer/bookings', 'ADMIN')).toBe('/admin/workers');

    // Reject public auth pages (login/register) to prevent loops
    expect(getSafeRedirectPath('/login', 'CUSTOMER')).toBe('/customer/dashboard');
    expect(getSafeRedirectPath('/register', 'WORKER')).toBe('/worker/dashboard');

    // Reject external or malformed URLs
    expect(getSafeRedirectPath('https://malicious-site.com', 'CUSTOMER')).toBe('/customer/dashboard');
    expect(getSafeRedirectPath('//evil.com', 'CUSTOMER')).toBe('/customer/dashboard');
    expect(getSafeRedirectPath(null, 'CUSTOMER')).toBe('/customer/dashboard');
  });
});

describe('PublicAuthRoute Guard', () => {
  it('permits unauthenticated users to access login and register', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      role: null,
      isAuthenticated: false,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicAuthRoute>
                <div>Public Login Page</div>
              </PublicAuthRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Public Login Page')).toBeDefined();
  });

  it('redirects authenticated Customer away from /login to customer dashboard', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'cust1', role: 'CUSTOMER' },
      role: 'CUSTOMER',
      isAuthenticated: true,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicAuthRoute>
                <div>Public Login Page</div>
              </PublicAuthRoute>
            }
          />
          <Route path="/customer/dashboard" element={<div>Customer Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Public Login Page')).toBeNull();
    expect(screen.getByText('Customer Dashboard Page')).toBeDefined();
  });

  it('redirects authenticated Worker away from /register to worker dashboard', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'worker1', role: 'WORKER' },
      role: 'WORKER',
      isAuthenticated: true,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route
            path="/register"
            element={
              <PublicAuthRoute>
                <div>Public Register Page</div>
              </PublicAuthRoute>
            }
          />
          <Route path="/worker/dashboard" element={<div>Worker Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Public Register Page')).toBeNull();
    expect(screen.getByText('Worker Dashboard Page')).toBeDefined();
  });

  it('redirects authenticated Admin away from /login to admin workers portal', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'admin1', role: 'ADMIN' },
      role: 'ADMIN',
      isAuthenticated: true,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicAuthRoute>
                <div>Public Login Page</div>
              </PublicAuthRoute>
            }
          />
          <Route path="/admin/workers" element={<div>Admin Workers Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Public Login Page')).toBeNull();
    expect(screen.getByText('Admin Workers Page')).toBeDefined();
  });
});

describe('Home 2 Service Redesigned Navbar', () => {
  beforeEach(() => {
    vi.spyOn(NotificationContextModule, 'useNotifications').mockReturnValue({
      notifications: [],
      unreadCount: 3,
      fetchNotifications: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    });
  });

  it('renders official Home 2 Service logo and unauthenticated links', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      role: null,
      isAuthenticated: false,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    const logoImg = screen.getByAltText(/Home 2 Service/i);
    expect(logoImg).toBeDefined();
    expect(logoImg.getAttribute('src')).toBe('/assets/home-2-service-logo.png');

    // Unauthenticated navigation
    expect(screen.getAllByText(/Services/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sign In/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Register/i).length).toBeGreaterThan(0);
  });

  it('renders customer role-specific links, user pill, and notification badge', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'cbe_customer', role: 'CUSTOMER' },
      role: 'CUSTOMER',
      isAuthenticated: true,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Book a Service/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/My Bookings/i).length).toBeGreaterThan(0);
    expect(screen.getByText('cbe_customer')).toBeDefined();
    expect(screen.getByText('CUSTOMER')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined(); // Notification count badge
    expect(screen.queryByText(/Verification/i)).toBeNull(); // No admin links
    expect(screen.queryByText(/Job Offers/i)).toBeNull(); // No worker links
  });

  it('renders worker role-specific links and badge', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'electrician_ravi', role: 'WORKER' },
      role: 'WORKER',
      isAuthenticated: true,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Job Offers/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/My Services/i).length).toBeGreaterThan(0);
    expect(screen.getByText('WORKER')).toBeDefined();
    expect(screen.queryByText(/My Bookings/i)).toBeNull(); // No customer links
  });

  it('renders admin role-specific links and badge', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'superadmin', role: 'ADMIN' },
      role: 'ADMIN',
      isAuthenticated: true,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Verification/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Catalog/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bookings/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Audit/i).length).toBeGreaterThan(0);
    expect(screen.getByText('ADMIN')).toBeDefined();
  });

  it('toggles mobile menu and closes on action', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'cbe_customer', role: 'CUSTOMER' },
      role: 'CUSTOMER',
      isAuthenticated: true,
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    const toggleBtn = screen.getByLabelText(/Open Navigation Menu/i);
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(screen.getByLabelText(/Close Menu/i)).toBeDefined();
  });

  it('applies active class to current route for worker links (Dashboard, Job Offers, My Services)', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'electrician_ravi', role: 'WORKER' },
      role: 'WORKER',
      isAuthenticated: true,
      logout: vi.fn(),
    });

    const { unmount: unmount1 } = render(
      <MemoryRouter initialEntries={['/worker/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );
    const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0];
    expect(dashboardLink.className).toContain('active');
    unmount1();

    const { unmount: unmount2 } = render(
      <MemoryRouter initialEntries={['/worker/offers']}>
        <Navbar />
      </MemoryRouter>
    );
    const offersLink = screen.getAllByRole('link', { name: /Job Offers/i })[0];
    expect(offersLink.className).toContain('active');
    unmount2();

    render(
      <MemoryRouter initialEntries={['/worker/services']}>
        <Navbar />
      </MemoryRouter>
    );
    const servicesLink = screen.getAllByRole('link', { name: /My Services/i })[0];
    expect(servicesLink.className).toContain('active');
  });
});
