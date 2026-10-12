import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Wrench, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Zap,
  Search,
  Droplet,
  Tv,
  PaintBucket,
  Hammer,
  Receipt,
  Navigation
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const POPULAR_CATEGORIES = [
  { name: 'Plumbing', icon: Droplet, desc: 'Leakages, taps, pipe fittings & sanitary work', slug: 'plumbing' },
  { name: 'Electrical', icon: Zap, desc: 'Switches, wiring, circuit breakers & lighting', slug: 'electrical' },
  { name: 'Appliance Repair', icon: Tv, desc: 'Washing machines, refrigerators & geysers', slug: 'appliance-repair' },
  { name: 'Carpentry', icon: Hammer, desc: 'Doors, locks, modular cabinets & repairs', slug: 'carpentry' },
  { name: 'Painting & Masonry', icon: PaintBucket, desc: 'Wall touch-ups, patch repairs & tiling', slug: 'painting' },
  { name: 'General Repairs', icon: Wrench, desc: 'Drilling, fixture installation & maintenance', slug: 'general-repairs' }
];

const HOW_IT_WORKS_STEPS = [
  {
    num: '01',
    title: 'Select Service & Location',
    desc: 'Choose from electrical, plumbing, appliance repair, or carpentry and pinpoint your Coimbatore address on the interactive map.'
  },
  {
    num: '02',
    title: '5 km Broadcast Dispatch',
    desc: 'Eligible verified professionals within a 5 km radius receive your booking offer with a 60-second broadcast window.'
  },
  {
    num: '03',
    title: 'Itemized Transparent Quote',
    desc: 'The assigned worker inspects the site and submits an itemized quotation separating labor charges and materials.'
  },
  {
    num: '04',
    title: 'Customer Approval Required',
    desc: 'Work never begins without your explicit consent. Review charges, decline with feedback, or approve with one tap.'
  },
  {
    num: '05',
    title: 'Live Tracking & Completion',
    desc: 'Monitor the worker arrival via live GPS map updates. Inspect completed work before closing the service request.'
  }
];

export default function Home() {
  const { isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
      {/* Full-Width Spacious Hero Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F9FD 100%)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: 'clamp(2.5rem, 6vw, 4.5rem) clamp(1.5rem, 5vw, 4rem)',
          boxShadow: 'var(--shadow-md)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            alignItems: 'center',
            gap: '3rem'
          }}
        >
          {/* Left Column: Headlines & CTAs */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--brand-pale)',
                color: 'var(--brand-blue)',
                padding: '0.4rem 0.95rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.85rem',
                fontWeight: 700,
                marginBottom: '1.5rem',
                border: '1px solid rgba(8, 127, 186, 0.15)'
              }}
            >
              <MapPin size={15} /> Coimbatore Local Services Marketplace
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
                fontWeight: 800,
                lineHeight: 1.15,
                marginBottom: '1.25rem',
                color: 'var(--brand-navy)',
                letterSpacing: '-0.025em'
              }}
            >
              Expert Home Care <br />
              <span style={{ color: 'var(--brand-blue)' }}>At Your Doorstep</span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
                color: 'var(--text-secondary)',
                marginBottom: '2.25rem',
                lineHeight: 1.65,
                maxWidth: '560px'
              }}
            >
              Connect with verified independent service professionals in your neighborhood. 
              Enjoy rapid 5 km dispatch, itemized quotes before work starts, and live GPS arrival tracking.
            </p>

            {/* CTAs */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}
            >
              {!isAuthenticated ? (
                <>
                  <Link to="/services" className="btn btn-primary btn-lg">
                    Book a Service <ArrowRight size={18} />
                  </Link>
                  <Link to="/register" className="btn btn-secondary btn-lg">
                    Join as Service Professional
                  </Link>
                </>
              ) : role === 'CUSTOMER' ? (
                <>
                  <Link to="/services" className="btn btn-primary btn-lg">
                    Book a Service <ArrowRight size={18} />
                  </Link>
                  <Link to="/customer/dashboard" className="btn btn-secondary btn-lg">
                    Customer Dashboard
                  </Link>
                </>
              ) : role === 'WORKER' ? (
                <>
                  <Link to="/worker/offers" className="btn btn-primary btn-lg">
                    View Job Broadcasts <ArrowRight size={18} />
                  </Link>
                  <Link to="/worker/dashboard" className="btn btn-secondary btn-lg">
                    Worker Dashboard
                  </Link>
                </>
              ) : (
                <Link to="/admin/workers" className="btn btn-navy btn-lg">
                  Admin Verification Queue <ArrowRight size={18} />
                </Link>
              )}
            </div>

            {/* Trust highlights under CTA */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.75rem',
                marginTop: '2.5rem',
                paddingTop: '1.75rem',
                borderTop: '1px solid var(--border-subtle)',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--brand-navy)', fontWeight: 600 }}>
                <CheckCircle2 size={17} style={{ color: 'var(--brand-blue)' }} /> 100% Verified Workers
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--brand-navy)', fontWeight: 600 }}>
                <CheckCircle2 size={17} style={{ color: 'var(--brand-blue)' }} /> Upfront Itemized Quotes
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--brand-navy)', fontWeight: 600 }}>
                <CheckCircle2 size={17} style={{ color: 'var(--brand-blue)' }} /> Real-time GPS Tracking
              </div>
            </div>
          </div>

          {/* Right Column: Prominent Logo Graphic & Brand Showcase Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 'var(--radius-xl)',
                padding: '2.5rem 2rem',
                boxShadow: 'var(--shadow-lg)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'center',
                maxWidth: '420px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem'
              }}
            >
              <img
                src="/assets/home-2-service-logo.png"
                alt="Home 2 Service"
                style={{
                  width: '180px',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
              <div>
                <h3 style={{ fontSize: '1.45rem', color: 'var(--brand-navy)', fontWeight: 800, marginBottom: '0.2rem' }}>
                  Home 2 Service
                </h3>
                <span style={{ fontSize: '0.9rem', color: 'var(--brand-blue)', fontWeight: 600, letterSpacing: '0.04em' }}>
                  Your Home &bull; Our Services
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Proudly operating in Coimbatore. On-demand plumbing, electrical, carpentry, appliances, and repair services with verified pros.
              </p>
              <div
                style={{
                  background: 'var(--brand-pale)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 1rem',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.8125rem',
                  color: 'var(--brand-navy)',
                  fontWeight: 600
                }}
              >
                <span>Dispatch Radius</span>
                <span className="badge badge-info" style={{ fontWeight: 700 }}>5.0 km Local Match</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Categories Grid */}
      <section>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.65rem', color: 'var(--brand-navy)' }}>Popular Home Services</h2>
            <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)' }}>Browse top requested repair and maintenance categories across Coimbatore</p>
          </div>
          <Link
            to="/services"
            style={{
              color: 'var(--brand-blue)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            View Full Service Catalog <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid-3" style={{ gap: '1.25rem' }}>
          {POPULAR_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.name}
                className="card card-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  cursor: 'pointer',
                  padding: '1.5rem',
                  borderTop: '3px solid transparent',
                  transition: 'all var(--transition-normal)'
                }}
                onClick={() => navigate(`/services`)}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--brand-pale)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brand-blue)'
                  }}
                >
                  <Icon size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.35rem', color: 'var(--brand-navy)' }}>{cat.name}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{cat.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How Home 2 Service Works */}
      <section
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: ' clamp(2rem, 5vw, 3.5rem) clamp(1.25rem, 4vw, 2.5rem)',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 3rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--brand-blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Transparent &amp; Reliable Process
          </span>
          <h2 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginTop: '0.35rem', marginBottom: '0.5rem' }}>
            How Home 2 Service Operates
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            A dependable, customer-first service sequence designed for complete trust, fast response, and total transparency
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem'
          }}
        >
          {HOW_IT_WORKS_STEPS.map((step) => (
            <div
              key={step.num}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                background: 'var(--bg-main)',
                padding: '1.5rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--brand-navy)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.05rem'
                }}
              >
                {step.num}
              </div>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--brand-navy)' }}>{step.title}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust & Coverage Highlights */}
      <section style={{ marginBottom: '1rem' }}>
        <div className="grid-3" style={{ gap: '1.25rem' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-pale)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-blue)',
                flexShrink: 0
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', marginBottom: '0.35rem', color: 'var(--brand-navy)' }}>Admin-Verified Professionals</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Every professional profile undergoes rigorous identity check, skill review, and admin verification before dispatch.
              </p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'var(--success-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)',
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', marginBottom: '0.35rem', color: 'var(--brand-navy)' }}>Guaranteed Quotation Review</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Work can never start without your explicit quote acceptance. Decline or request revisions anytime.
              </p>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1.5rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'var(--brand-pale)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-blue)',
                flexShrink: 0
              }}
            >
              <MapPin size={24} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.05rem', marginBottom: '0.35rem', color: 'var(--brand-navy)' }}>Coimbatore Coverage</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Active in Gandhipuram, RS Puram, Peelamedu, Saibaba Colony, Singanallur, and surrounding neighborhoods.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
