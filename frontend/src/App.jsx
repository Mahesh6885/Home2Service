import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import PublicAuthRoute from './components/PublicAuthRoute';
import IdleSessionModal from './components/IdleSessionModal';

// Public pages
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ServiceCatalog from './pages/customer/ServiceCatalog';

// Customer pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CreateBooking from './pages/customer/CreateBooking';
import CustomerBookings from './pages/customer/CustomerBookings';
import BookingDetail from './pages/customer/BookingDetail';
import CustomerNotifications from './pages/customer/CustomerNotifications';

// Worker pages
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerOffers from './pages/worker/WorkerOffers';
import WorkerServices from './pages/worker/WorkerServices';
import WorkerJobDetail from './pages/worker/WorkerJobDetail';

// Admin pages
import WorkerApprovalQueue from './pages/admin/WorkerApprovalQueue';
import AdminCatalog from './pages/admin/AdminCatalog';
import AdminBookings from './pages/admin/AdminBookings';
import AdminAuditEvents from './pages/admin/AdminAuditEvents';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <div className="app-layout">
            <Navbar />
            <IdleSessionModal />
            <main className="main-content">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route
                  path="/login"
                  element={
                    <PublicAuthRoute>
                      <Login />
                    </PublicAuthRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicAuthRoute>
                      <Register />
                    </PublicAuthRoute>
                  }
                />
                <Route path="/services" element={<ServiceCatalog />} />

                {/* Customer Routes */}
                <Route
                  path="/customer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <CustomerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/book"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <CreateBooking />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/bookings"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <CustomerBookings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/bookings/:id"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <BookingDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/customer/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['CUSTOMER']}>
                      <CustomerNotifications />
                    </ProtectedRoute>
                  }
                />

                {/* Worker Routes */}
                <Route
                  path="/worker/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/offers"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerOffers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/services"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerServices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/jobs/:id"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerJobDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <CustomerNotifications />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes */}
                <Route
                  path="/admin/workers"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <WorkerApprovalQueue />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/catalog"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminCatalog />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/bookings"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminBookings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/audit"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminAuditEvents />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
