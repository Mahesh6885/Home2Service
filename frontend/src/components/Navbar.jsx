import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Layers, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CheckSquare, 
  FileText,
  Menu,
  X,
  Compass,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationDrawer from './NotificationDrawer';

export default function Navbar() {
  const { user, role, isAuthenticated, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setMobileMenuOpen(false);
      setDrawerOpen(false);
      navigate('/', { replace: true });
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* 1. Left: Official Brand & Logo */}
        <div className="navbar-brand-section">
          <Link to="/" className="brand-link" onClick={closeMobileMenu} aria-label="Home 2 Service Homepage">
            <img
              src="/assets/home-2-service-logo.png"
              alt="Home 2 Service"
              className="brand-logo-img"
            />
            <div className="brand-title-wrap">
              <span className="brand-name">
                Home <span className="brand-name-accent">2</span> Service
              </span>
              <span className="brand-tagline">Your Home • Our Services</span>
            </div>
          </Link>
        </div>

        {/* 2. Center: Role-aware Desktop Primary Navigation */}
        <nav className="navbar-center-nav desktop-nav" aria-label="Primary Navigation">
          <ul className="navbar-nav-list">
            {!isAuthenticated ? (
              <>
                <li>
                  <NavLink 
                    to="/services" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Compass size={15} /> Services
                  </NavLink>
                </li>
                <li>
                  <a href="/#how-it-works" className="nav-link">
                    How It Works
                  </a>
                </li>
              </>
            ) : role === 'CUSTOMER' ? (
              <>
                <li>
                  <NavLink 
                    to="/customer/dashboard" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <LayoutDashboard size={15} /> Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/services" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Compass size={15} /> Book a Service
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/customer/bookings" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Calendar size={15} /> My Bookings
                  </NavLink>
                </li>
              </>
            ) : role === 'WORKER' ? (
              <>
                <li>
                  <NavLink 
                    to="/worker/dashboard" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <LayoutDashboard size={15} /> Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/worker/offers" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Clock size={15} /> Job Offers
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/worker/services" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Layers size={15} /> My Services
                  </NavLink>
                </li>
              </>
            ) : role === 'ADMIN' ? (
              <>
                <li>
                  <NavLink 
                    to="/admin/workers" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <ShieldCheck size={15} /> Verification
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/catalog" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Layers size={15} /> Catalog
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/bookings" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <CheckSquare size={15} /> Bookings
                  </NavLink>
                </li>
                <li>
                  <NavLink 
                    to="/admin/audit" 
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  >
                    <FileText size={15} /> Audit
                  </NavLink>
                </li>
              </>
            ) : null}
          </ul>
        </nav>

        {/* 3. Right: Notifications, User Pill & Actions */}
        <div className="navbar-actions-section">
          {!isAuthenticated ? (
            <div className="desktop-nav navbar-auth-actions">
              <NavLink 
                to="/login" 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                Sign In
              </NavLink>
              <Link to="/register" className="btn btn-primary btn-sm navbar-cta-btn">
                Register
              </Link>
            </div>
          ) : (
            <>
              {/* Notification Bell with Badge */}
              <div className="notification-bell-wrapper">
                <button
                  type="button"
                  className={`navbar-icon-btn ${drawerOpen ? 'active' : ''}`}
                  onClick={() => setDrawerOpen(!drawerOpen)}
                  aria-label="Toggle notifications"
                  title="Notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="navbar-badge" aria-label={`${unreadCount} unread notifications`}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <NotificationDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
              </div>

              {/* User Profile Pill with Subtle Role Badge */}
              <div className="navbar-user-pill desktop-nav">
                <UserIcon size={14} className="user-pill-icon" />
                <span className="user-pill-name">{user?.username}</span>
                <span className={`user-role-badge role-${role?.toLowerCase()}`}>
                  {role}
                </span>
              </div>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="navbar-logout-btn desktop-nav"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={closeMobileMenu}>
          <div 
            className="mobile-drawer-panel" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile User Header */}
            {isAuthenticated && (
              <div className="mobile-user-card">
                <div className="mobile-user-avatar">
                  <UserIcon size={18} />
                </div>
                <div className="mobile-user-info">
                  <div className="mobile-user-name">{user?.username}</div>
                  <span className={`user-role-badge role-${role?.toLowerCase()}`}>
                    {role} Account
                  </span>
                </div>
              </div>
            )}

            {/* Mobile Nav Links */}
            <nav className="mobile-nav-links" aria-label="Mobile Navigation">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/services"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <Compass size={16} /> Services Catalog
                  </Link>
                  <a
                    href="/#how-it-works"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    How It Works
                  </a>
                  <div className="mobile-auth-divider" />
                  <Link
                    to="/login"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-primary"
                    style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
                    onClick={closeMobileMenu}
                  >
                    Register / Get Started
                  </Link>
                </>
              ) : role === 'CUSTOMER' ? (
                <>
                  <Link
                    to="/customer/dashboard"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/services"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    Book a Service
                  </Link>
                  <Link
                    to="/customer/bookings"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <Calendar size={16} /> My Bookings
                  </Link>
                </>
              ) : role === 'WORKER' ? (
                <>
                  <Link
                    to="/worker/dashboard"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/worker/offers"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <Clock size={16} /> Job Offers
                  </Link>
                  <Link
                    to="/worker/services"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <Layers size={16} /> My Services
                  </Link>
                </>
              ) : role === 'ADMIN' ? (
                <>
                  <Link
                    to="/admin/workers"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <ShieldCheck size={16} /> Worker Verification
                  </Link>
                  <Link
                    to="/admin/catalog"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <Layers size={16} /> Services Catalog
                  </Link>
                  <Link
                    to="/admin/bookings"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <CheckSquare size={16} /> All Bookings
                  </Link>
                  <Link
                    to="/admin/audit"
                    className="mobile-nav-link"
                    onClick={closeMobileMenu}
                  >
                    <FileText size={16} /> Audit Trail
                  </Link>
                </>
              ) : null}

              {/* Mobile Logout Action */}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mobile-logout-btn"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
