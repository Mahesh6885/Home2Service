import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import * as AuthContextModule from '../context/AuthContext';
import { api } from '../api/client';
import WorkerJobDetail from '../pages/worker/WorkerJobDetail';
import BookingDetail from '../pages/customer/BookingDetail';

describe('Workflow Invariants & Authorization Rules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('restricts access when user lacks required role', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'worker1', role: 'WORKER' },
      role: 'WORKER',
      isAuthenticated: true,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin/workers']}>
        <Routes>
          <Route
            path="/admin/workers"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <div>Admin Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin Content')).toBeNull();
    expect(screen.getByText('Access Restricted')).toBeDefined();
    expect(screen.getByText(/Your current account role \(WORKER\) does not have permission/i)).toBeDefined();
  });

  it('permits authorized roles into protected routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { username: 'worker1', role: 'WORKER' },
      role: 'WORKER',
      isAuthenticated: true,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/worker/dashboard']}>
        <Routes>
          <Route
            path="/worker/dashboard"
            element={
              <ProtectedRoute allowedRoles={['WORKER']}>
                <div>Worker Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Worker Dashboard Content')).toBeDefined();
  });

  it('enforces work-start invariant in WorkerJobDetail: prevents start work when quote is pending', async () => {
    const mockBooking = {
      id: 'b101',
      service_name: 'Plumbing Repair',
      problem_description: 'Pipe leaking in kitchen',
      status: 'QUOTE_PENDING',
      service_address_line: '123 DB Road, RS Puram',
      service_city: 'Coimbatore',
      service_pincode: '641002',
    };
    const mockQuotes = [
      {
        id: 'q101',
        status: 'PENDING',
        work_description: 'Fix pipes and fittings',
        labor_charge: '450.00',
        materials_charge: '150.00',
        other_charges: '0.00',
        total_amount: '600.00',
        items: [],
      },
    ];

    vi.spyOn(api, 'get').mockImplementation((url) => {
      if (url.includes('/api/bookings/b101/')) return Promise.resolve(mockBooking);
      if (url.includes('/api/quotations/')) return Promise.resolve(mockQuotes);
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter initialEntries={['/worker/jobs/b101']}>
        <Routes>
          <Route path="/worker/jobs/:id" element={<WorkerJobDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Assigned Job #b101/i)).toBeDefined();
    });

    // Start work button must NOT be present when quote is pending
    expect(screen.queryByText(/Start Work Now/i)).toBeNull();
    expect(screen.getByText(/Quotation submitted\. Waiting for customer acceptance\./i)).toBeDefined();
  });

  it('enforces work-start authorization in WorkerJobDetail: allows start work once quote is QUOTE_ACCEPTED', async () => {
    const mockBooking = {
      id: 'b102',
      service_name: 'Plumbing Repair',
      problem_description: 'Pipe leaking in kitchen',
      status: 'QUOTE_ACCEPTED',
      service_address_line: '123 DB Road, RS Puram',
      service_city: 'Coimbatore',
      service_pincode: '641002',
    };
    const mockQuotes = [
      {
        id: 'q102',
        status: 'ACCEPTED',
        work_description: 'Fix pipes and fittings',
        labor_charge: '450.00',
        materials_charge: '150.00',
        other_charges: '0.00',
        total_amount: '600.00',
        items: [],
      },
    ];

    vi.spyOn(api, 'get').mockImplementation((url) => {
      if (url.includes('/api/bookings/b102/')) return Promise.resolve(mockBooking);
      if (url.includes('/api/quotations/')) return Promise.resolve(mockQuotes);
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter initialEntries={['/worker/jobs/b102']}>
        <Routes>
          <Route path="/worker/jobs/:id" element={<WorkerJobDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Assigned Job #b102/i)).toBeDefined();
    });

    // Start work button is authorized and displayed
    expect(screen.getByText(/Start Work Now/i)).toBeDefined();
    expect(screen.getByText(/Customer accepted quotation! You are authorized to begin work\./i)).toBeDefined();
  });

  it('renders server-authoritative quotation breakdown and total in BookingDetail', async () => {
    const mockBooking = {
      id: 'b103',
      service_name: 'Electrical Inspection',
      problem_description: 'Power trip in living room',
      status: 'QUOTE_PENDING',
      created_at: new Date().toISOString(),
      service_address_line: '45 Avinashi Road',
      service_city: 'Coimbatore',
      service_pincode: '641018',
      worker_name: 'Murugan Tech',
      worker_phone: '+91 98765 43210',
    };
    const mockQuotes = [
      {
        id: 'q103',
        status: 'PENDING',
        work_description: 'Circuit breaker diagnosis and MCB replacement',
        labor_charge: '500.00',
        materials_charge: '350.00',
        other_charges: '50.00',
        total_amount: '900.00',
        items: [
          { description: 'Diagnose MCB', item_type: 'LABOR', quantity: 1, unit_price: '500.00', line_total: '500.00' },
          { description: 'Replacement MCB 32A', item_type: 'MATERIAL', quantity: 1, unit_price: '350.00', line_total: '350.00' },
        ],
      },
    ];

    vi.spyOn(api, 'get').mockImplementation((url) => {
      if (url.includes('/quotations/')) return Promise.resolve(mockQuotes);
      if (url.includes('/api/bookings/b103/')) return Promise.resolve(mockBooking);
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <MemoryRouter initialEntries={['/customer/bookings/b103']}>
        <Routes>
          <Route path="/customer/bookings/:id" element={<BookingDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Electrical Inspection/i)).toBeDefined();
    });

    // Check server-calculated charges and items
    expect(screen.getAllByText('₹500.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹350.00').length).toBeGreaterThan(0);
    expect(screen.getByText('₹900.00')).toBeDefined();
    expect(screen.getByText(/Accept Quotation/i)).toBeDefined();
    expect(screen.getByText(/Decline/i)).toBeDefined();
  });
});
