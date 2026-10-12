import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  User, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertTriangle, 
  FileText, 
  Receipt,
  Phone,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import ConfirmationModal from '../../components/ConfirmationModal';
import WorkerLocationMap from '../../components/map/WorkerLocationMap';

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowReason, setNoShowReason] = useState('');
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignReason, setReassignReason] = useState('');

  const handleReportNoShow = async (e) => {
    e.preventDefault();
    if (!noShowReason.trim()) {
      setError('Please provide a reason for reporting the no-show.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/report-no-show/`, { reason: noShowReason.trim() });
      setShowNoShowModal(false);
      setSuccessMsg('No-show incident report filed. We are reviewing this immediately.');
      loadBookingAndQuotes();
    } catch (err) {
      setError(err.message || 'Failed to file no-show report.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReassign = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/api/bookings/${id}/reassign/`, {
        reason: reassignReason || 'Worker no-show or unresponsive'
      });
      setShowReassignModal(false);
      setSuccessMsg(res.message || 'Worker released. Broadcasted to nearby professionals.');
      loadBookingAndQuotes();
    } catch (err) {
      setError(err.message || 'Failed to reassign booking.');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadBookingAndQuotes();
  }, [id]);

  useEffect(() => {
    if (!booking?.assigned_worker) {
      setTrackingData(null);
      return;
    }
    const activeStatuses = ['ASSIGNED', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'IN_PROGRESS'];
    if (!activeStatuses.includes(booking.status)) {
      setTrackingData(null);
      return;
    }

    let isMounted = true;
    const fetchTracking = async () => {
      try {
        const data = await api.get(`/api/bookings/${id}/tracking/`);
        if (isMounted) {
          setTrackingData(data);
        }
      } catch (err) {
        // Polling errors handled gracefully
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [id, booking?.assigned_worker, booking?.status]);

  const loadBookingAndQuotes = async () => {
    setLoading(true);
    setError('');
    try {
      const [bookingData, quotesData] = await Promise.all([
        api.get(`/api/bookings/${id}/`),
        api.get(`/api/bookings/${id}/quotations/`).catch(() => [])
      ]);
      setBooking(bookingData);
      setQuotations(Array.isArray(quotesData) ? quotesData : (quotesData.results || []));
    } catch (err) {
      setError(err.message || 'Failed to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/cancel/`, { reason: cancelReason || 'Customer requested cancellation.' });
      setShowCancelModal(false);
      setSuccessMsg('Booking cancelled successfully.');
      loadBookingAndQuotes();
    } catch (err) {
      setError(err.message || 'Failed to cancel booking.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryDispatch = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/api/bookings/${id}/retry/`);
      setSuccessMsg(res.message || 'Broadcast re-dispatched to nearby professionals!');
      loadBookingAndQuotes();
    } catch (err) {
      setError(err.message || 'Failed to retry dispatch.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptQuotation = async (quoteId) => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/quotations/${quoteId}/accept/`);
      setSuccessMsg('Quotation accepted! The worker is authorized to proceed with the service.');
      loadBookingAndQuotes();
    } catch (err) {
      setError(err.message || 'Failed to accept quotation.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineQuotation = async () => {
    if (!selectedQuoteId) return;
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/quotations/${selectedQuoteId}/decline/`, {
        reason: declineReason || 'Price revision requested.'
      });
      setShowDeclineModal(false);
      setSuccessMsg('Quotation declined. The worker may review and provide a revised quote.');
      loadBookingAndQuotes();
    } catch (err) {
      setError(err.message || 'Failed to decline quotation.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Loading booking details..." />;
  }

  if (!booking) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2>Booking Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
          The requested booking could not be retrieved.
        </p>
        <button onClick={() => navigate('/customer/bookings')} className="btn btn-secondary">
          Back to Bookings
        </button>
      </div>
    );
  }

  const latestQuote = quotations[0] || null;

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Bar with Navigation & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          onClick={() => navigate('/customer/bookings')}
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft size={16} /> Back to My Bookings
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Booking ID: <strong style={{ color: 'var(--brand-navy)' }}>#{String(booking.id).slice(0, 8)}</strong>
          </span>
          <StatusBadge status={booking.status} />
        </div>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '1rem 1.25rem',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success)',
            fontSize: '0.925rem',
            fontWeight: 500
          }}
        >
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Main Full-Width Header Card with Stepper */}
      <div className="card" style={{ padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-blue)', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
              <span>Home 2 Service Request</span>
            </div>
            <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginBottom: '0.35rem' }}>
              {booking.service_name || 'Service Request'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, maxWidth: '800px', lineHeight: 1.5 }}>
              {booking.problem_description}
            </p>
          </div>

          {['REQUESTED', 'SEARCHING'].includes(booking.status) && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="btn btn-secondary btn-sm"
              disabled={actionLoading}
            >
              Cancel Request
            </button>
          )}
        </div>

        {/* Stepper Progress Bar */}
        {booking.status !== 'CANCELLED' && booking.status !== 'EXPIRED' && (
          <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', position: 'relative' }}>
              {[
                { label: 'Submitted', active: true },
                { label: 'Worker Assigned', active: ['ASSIGNED', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status) },
                { label: 'Quotation', active: ['QUOTE_ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status) },
                { label: 'In Progress', active: ['IN_PROGRESS', 'COMPLETED'].includes(booking.status) },
                { label: 'Completed', active: booking.status === 'COMPLETED' },
              ].map((step, idx) => (
                <div key={idx} style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      height: '5px',
                      borderRadius: '3px',
                      background: step.active ? 'var(--brand-blue)' : 'var(--border-subtle)',
                      marginBottom: '0.5rem',
                      transition: 'background var(--transition-normal)'
                    }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: step.active ? 700 : 500, color: step.active ? 'var(--brand-navy)' : 'var(--text-muted)' }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Responsive Two-Column Split Layout */}
      <div className="layout-split">
        {/* Main Column: Details, Quotation Breakdown, Customer Approval */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Searching Alert Banner */}
          {booking.status === 'SEARCHING' && (
            <div className="card" style={{ background: 'var(--brand-pale)', borderColor: 'rgba(8, 127, 186, 0.25)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <Clock size={20} style={{ color: 'var(--brand-blue)' }} /> Broadcasting to Nearby Professionals
                  </h4>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.35rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Verified professionals within 5 km have received your offer. Waiting for the first valid acceptance.
                  </p>
                </div>
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="btn btn-secondary btn-sm"
                  disabled={actionLoading}
                >
                  Cancel Request
                </button>
              </div>
            </div>
          )}

          {/* Expired Round Banner */}
          {booking.status === 'EXPIRED' && (
            <div className="card" style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning-border)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <AlertTriangle size={20} style={{ color: 'var(--warning)' }} /> Search Window Expired
                  </h4>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.35rem', color: 'var(--text-secondary)', margin: 0 }}>
                    No professionals accepted within the 60-second broadcast window. You can retry dispatch immediately.
                  </p>
                </div>
                <button
                  onClick={handleRetryDispatch}
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading}
                >
                  <RefreshCw size={14} /> Retry Dispatch Now
                </button>
              </div>
            </div>
          )}

          {/* Quotation & Scope Section */}
          <div className="card" style={{ padding: '1.75rem 2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--brand-pale)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brand-blue)'
                  }}
                >
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--brand-navy)', margin: 0 }}>
                    Quotation &amp; Scope of Work
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                    Transparent itemized breakdown submitted by your service professional
                  </p>
                </div>
              </div>

              {latestQuote && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-info" style={{ fontWeight: 600 }}>
                    Revision {latestQuote.revision_number}
                  </span>
                  <StatusBadge status={latestQuote.status} />
                </div>
              )}
            </div>

            {!latestQuote ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem' }} />
                <h4 style={{ fontSize: '1rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
                  No Quotation Submitted Yet
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto' }}>
                  {booking.assigned_worker
                    ? 'The service professional is assessing the requirements and will submit an itemized quote.'
                    : 'A formal quotation will be submitted once a service professional accepts your request.'}
                </p>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    background: 'var(--bg-main)',
                    padding: '1.25rem',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.5rem'
                  }}
                >
                  <strong style={{ fontSize: '0.9rem', color: 'var(--brand-navy)', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Work Scope Description
                  </strong>
                  <p style={{ fontSize: '0.925rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                    {latestQuote.work_description}
                  </p>
                </div>

                {/* Line items if available */}
                {latestQuote.items && latestQuote.items.length > 0 && (
                  <div style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Item Description</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Category</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Unit Rate</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestQuote.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--brand-navy)', fontWeight: 600 }}>{item.description}</td>
                            <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                              <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                                {item.item_type}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>₹{item.unit_price}</td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--brand-navy)' }}>₹{item.line_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Authoritative Charges Breakdown Card */}
                <div
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.5rem',
                    fontSize: '0.925rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Labor Charges:</span>
                    <span style={{ fontWeight: 600, color: 'var(--brand-navy)' }}>₹{latestQuote.labor_charge}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Materials &amp; Hardware:</span>
                    <span style={{ fontWeight: 600, color: 'var(--brand-navy)' }}>₹{latestQuote.materials_charge}</span>
                  </div>
                  {parseFloat(latestQuote.other_charges) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Other Inspection/Transport:</span>
                      <span style={{ fontWeight: 600, color: 'var(--brand-navy)' }}>₹{latestQuote.other_charges}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '2px solid var(--border-subtle)',
                      paddingTop: '0.85rem',
                      marginTop: '0.85rem',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      color: 'var(--brand-navy)'
                    }}
                  >
                    <span>Total Authoritative Quote:</span>
                    <span style={{ color: 'var(--brand-blue)' }}>₹{latestQuote.total_amount}</span>
                  </div>
                </div>

                {/* Customer Quotation Actions */}
                {latestQuote.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: '0.5rem' }}>
                    <button
                      onClick={() => {
                        setSelectedQuoteId(latestQuote.id);
                        setShowDeclineModal(true);
                      }}
                      className="btn btn-secondary"
                      disabled={actionLoading}
                    >
                      <XCircle size={17} /> Decline with Feedback
                    </button>
                    <button
                      onClick={() => handleAcceptQuotation(latestQuote.id)}
                      className="btn btn-primary btn-lg"
                      disabled={actionLoading}
                    >
                      <CheckCircle size={18} /> Accept Quotation &amp; Authorize Work
                    </button>
                  </div>
                )}

                {latestQuote.status === 'ACCEPTED' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '1rem 1.25rem',
                      background: 'var(--success-bg)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--success)',
                      fontSize: '0.925rem',
                      fontWeight: 600,
                      border: '1px solid var(--success-border)'
                    }}
                  >
                    <CheckCircle size={20} />
                    <span>Quotation Accepted. The service professional is authorized to begin work.</span>
                  </div>
                )}

                {latestQuote.status === 'DECLINED' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      padding: '1rem 1.25rem',
                      background: 'var(--danger-bg)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--danger)',
                      fontSize: '0.925rem',
                      fontWeight: 600,
                      border: '1px solid var(--danger-border)'
                    }}
                  >
                    <XCircle size={20} />
                    <span>Quotation was declined. Awaiting revised quotation from the service professional.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Column: Assigned Worker, Live Tracking Map, Address Card */}
        <div className="layout-sidebar sticky">
          {/* Assigned Service Professional Card */}
          {booking.assigned_worker ? (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-navy)' }}>
                  <User size={18} style={{ color: 'var(--brand-blue)' }} /> Assigned Professional
                </h3>
                <span className="badge badge-success">Assigned</span>
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--brand-navy)', margin: 0 }}>
                  {booking.assigned_worker.business_name || booking.assigned_worker.username}
                </p>
                {booking.assigned_worker.phone_number && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                    <Phone size={14} style={{ color: 'var(--brand-blue)' }} /> {booking.assigned_worker.phone_number}
                  </div>
                )}
              </div>

              {/* Transit & Arrival Status Alert */}
              {booking.travel_status && booking.travel_status !== 'NOT_STARTED' && (
                <div style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  background: booking.travel_status === 'ARRIVED' ? 'var(--success-bg)' : booking.travel_status === 'DELAYED' ? 'var(--warning-bg)' : 'var(--brand-pale)',
                  border: `1px solid ${booking.travel_status === 'ARRIVED' ? 'var(--success-border)' : booking.travel_status === 'DELAYED' ? 'var(--warning-border)' : 'rgba(8, 127, 186, 0.25)'}`,
                  marginBottom: '0.75rem',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={14} />
                    {booking.travel_status === 'HEADING_TO_JOB' && 'Professional En Route'}
                    {booking.travel_status === 'ARRIVED' && 'Professional Arrived at Location'}
                    {booking.travel_status === 'DELAYED' && 'Transit Delay Reported'}
                  </div>
                  {booking.delay_reason && (
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Reason: {booking.delay_reason}
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                <ShieldCheck size={14} style={{ color: 'var(--success)' }} /> Identity &amp; Skill Verified by Home 2 Service
              </div>

              {/* No-Show Reporting & Reassignment Actions */}
              {['ASSIGNED', 'QUOTE_PENDING', 'QUOTE_ACCEPTED'].includes(booking.status) && (
                <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    onClick={() => setShowNoShowModal(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', fontSize: '0.8rem', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                    disabled={actionLoading}
                  >
                    <AlertTriangle size={13} /> Report Professional Hasn't Arrived
                  </button>
                  <button
                    onClick={() => setShowReassignModal(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', fontSize: '0.8rem' }}
                    disabled={actionLoading}
                  >
                    <RefreshCw size={13} /> Reassign to Another Professional
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <User size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem' }} />
              <h4 style={{ fontSize: '1rem', color: 'var(--brand-navy)', marginBottom: '0.25rem' }}>
                No Worker Assigned Yet
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Offers have been sent to eligible nearby workers within 5 km.
              </p>
            </div>
          )}

          {/* Live GPS Worker Tracking Map (Wide & Spacious) */}
          {booking.assigned_worker && ['ASSIGNED', 'QUOTE_PENDING', 'QUOTE_ACCEPTED', 'IN_PROGRESS'].includes(booking.status) && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <h4 style={{ fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-navy)', fontWeight: 700 }}>
                  <MapPin size={16} style={{ color: 'var(--brand-blue)' }} /> Live Arrival Tracking
                </h4>
                <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                  Live GPS
                </span>
              </div>
              <WorkerLocationMap
                trackingData={trackingData}
                customerLocation={{
                  latitude: parseFloat(booking.service_latitude),
                  longitude: parseFloat(booking.service_longitude),
                  label: `${booking.service_address_title || 'Address'}: ${booking.service_address_line}`
                }}
                workerName={booking.assigned_worker.business_name || booking.assigned_worker.username || 'Assigned Professional'}
                height="380px"
              />
            </div>
          )}

          {/* Service Address Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--brand-navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
              <MapPin size={16} style={{ color: 'var(--brand-blue)' }} /> Destination Address
            </h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--brand-navy)', fontWeight: 600, margin: '0 0 0.25rem' }}>
              {booking.service_address_title ? `${booking.service_address_title}` : 'Selected Address'}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {booking.service_address_line}, {booking.service_city} - {booking.service_pincode}
            </p>
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <Calendar size={13} /> Created: {new Date(booking.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Booking Modal */}
      <ConfirmationModal
        isOpen={showCancelModal}
        title="Cancel Service Request"
        message="Are you sure you want to cancel this booking request? All active broadcast offers will be closed."
        confirmText="Yes, Cancel Booking"
        confirmVariant="danger"
        isLoading={actionLoading}
        onConfirm={handleCancelBooking}
        onCancel={() => setShowCancelModal(false)}
      />

      {/* Decline Quotation Modal */}
      {showDeclineModal && (
        <div className="modal-backdrop" onClick={() => setShowDeclineModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--brand-navy)' }}>Decline Quotation</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Let your service professional know why this quote was declined so they can revise the charges or work scope.
            </p>
            <div className="form-group">
              <label className="form-label">Feedback / Reason for Revision</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Please review labor charges or use customer-provided parts..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowDeclineModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeclineQuotation} disabled={actionLoading}>
                {actionLoading ? 'Declining...' : 'Decline Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report No-Show Modal */}
      {showNoShowModal && (
        <div className="modal-backdrop" onClick={() => setShowNoShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--brand-navy)' }}>Report Worker No-Show</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              If your assigned professional did not arrive within the scheduled window or is unreachable, file a report so our support team can intervene.
            </p>
            <form onSubmit={handleReportNoShow}>
              <div className="form-group">
                <label className="form-label">Incident Reason *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="e.g. Worker confirmed heading 45 mins ago but hasn't arrived and phone is unreachable..."
                  value={noShowReason}
                  onChange={(e) => setNoShowReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNoShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={actionLoading}>
                  {actionLoading ? 'Submitting...' : 'Submit Incident Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      <ConfirmationModal
        isOpen={showReassignModal}
        title="Reassign Booking to Another Professional"
        message="This will release the current worker assignment and immediately broadcast a new 60-second offer to other verified nearby professionals in Coimbatore. Are you sure you want to proceed?"
        confirmText="Yes, Release & Reassign"
        confirmVariant="primary"
        isLoading={actionLoading}
        onConfirm={handleReassign}
        onCancel={() => setShowReassignModal(false)}
      />
    </div>
  );
}
