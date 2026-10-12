import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, Receipt, Clock, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { isAuthenticated, role } = useAuth();

  return (
    <footer
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid var(--border-subtle)',
        marginTop: 'auto',
        padding: '3.5rem 0 2rem'
      }}
    >
      <div
        style={{
          width: '95%',
          maxWidth: 'var(--max-content-width)',
          margin: '0 auto'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '2.5rem',
            marginBottom: '3rem'
          }}
        >
          {/* Brand Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
              <img
                src="/assets/home-2-service-logo.png"
                alt="Home 2 Service"
                style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
              />
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    color: 'var(--brand-navy)',
                    lineHeight: 1.15
                  }}
                >
                  Home 2 Service
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--brand-blue)',
                    letterSpacing: '0.04em'
                  }}
                >
                  Your Home &bull; Our Services
                </span>
              </div>
            </Link>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Coimbatore's trusted on-demand local services marketplace. Connecting homeowners with verified 
              independent service professionals within a 5 km dispatch radius.
            </p>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--brand-navy)', fontWeight: 600 }}>
              <MapPin size={16} style={{ color: 'var(--brand-blue)' }} /> Coimbatore, Tamil Nadu
            </div>
          </div>

          {/* Customer Links */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Customer Hub
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: 0 }}>
              <li>
                <Link to="/services" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', transition: 'color 0.15s' }}>
                  Explore Services
                </Link>
              </li>
              <li>
                <Link to="/customer/book" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Book a Service
                </Link>
              </li>
              {isAuthenticated && role === 'CUSTOMER' && (
                <>
                  <li>
                    <Link to="/customer/dashboard" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Customer Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link to="/customer/bookings" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      My Bookings &amp; Tracking
                    </Link>
                  </li>
                </>
              )}
              {!isAuthenticated && (
                <li>
                  <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Customer Sign In
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Service Professional Links */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              For Professionals
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: 0 }}>
              {!isAuthenticated && (
                <>
                  <li>
                    <Link to="/register" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Join as Service Professional
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Worker Login
                    </Link>
                  </li>
                </>
              )}
              {isAuthenticated && role === 'WORKER' && (
                <>
                  <li>
                    <Link to="/worker/dashboard" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Worker Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link to="/worker/offers" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Live Job Broadcasts
                    </Link>
                  </li>
                  <li>
                    <Link to="/worker/services" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      My Skills &amp; Rate Card
                    </Link>
                  </li>
                </>
              )}
              <li>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Coimbatore Central Dispatch
                </span>
              </li>
            </ul>
          </div>

          {/* Platform Safeguards */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-navy)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Safeguards &amp; Trust
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <ShieldCheck size={16} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                <span>Admin-verified professionals only</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <Receipt size={16} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                <span>Authoritative itemized quotation review</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <Clock size={16} style={{ color: 'var(--brand-blue)', flexShrink: 0 }} />
                <span>Rapid 5 km radius neighborhood dispatch</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.8125rem',
            color: 'var(--text-muted)'
          }}
        >
          <div>
            &copy; {new Date().getFullYear()} <strong>Home 2 Service</strong>. All rights reserved. Coimbatore, Tamil Nadu.
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span>Gandhipuram &bull; RS Puram &bull; Peelamedu &bull; Saibaba Colony &bull; Singanallur</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
