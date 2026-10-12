import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  User, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle2, 
  Clock, 
  FileText,
  AlertCircle,
  Receipt,
  Navigation
} from 'lucide-react';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import LocationPickerMap from '../../components/map/LocationPickerMap';

export default function WorkerJobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Quotation Submission Form State
  const [workDescription, setWorkDescription] = useState('');
  const [items, setItems] = useState([
    { item_type: 'LABOR', description: 'Standard Diagnostic & Repair Labor', quantity: 1, unit_price: 300 }
  ]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadJobDetails();
  }, [id]);

  const loadJobDetails = async () => {
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
      setError(err.message || 'Failed to load job details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { item_type: 'MATERIAL', description: '', quantity: 1, unit_price: 0 }
    ]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const calculatePreviewTotal = () => {
    return items.reduce((acc, curr) => {
      const q = parseFloat(curr.quantity) || 0;
      const p = parseFloat(curr.unit_price) || 0;
      return acc + (q * p);
    }, 0).toFixed(2);
  };

  const handleSubmitQuotation = async (e) => {
    e.preventDefault();
    if (!workDescription.trim()) {
      setError('Please provide a scope/work description.');
      return;
    }
    if (items.length === 0) {
      setError('Please provide at least one charge or line item.');
      return;
    }

    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/quotations/`, {
        work_description: workDescription.trim(),
        items: items.map((i) => ({
          item_type: i.item_type,
          description: i.description,
          quantity: parseInt(i.quantity, 10) || 1,
          unit_price: parseFloat(i.unit_price) || 0
        })),
        notes: notes.trim()
      });
      setSuccessMsg('Quotation submitted successfully! Awaiting customer acceptance.');
      loadJobDetails();
    } catch (err) {
      setError(err.message || 'Failed to submit quotation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Transit Actions State & Handlers
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [delayEstMinutes, setDelayEstMinutes] = useState('15');

  const handleConfirmHeading = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/worker-heading/`);
      setSuccessMsg('Heading to customer location confirmed!');
      loadJobDetails();
    } catch (err) {
      setError(err.message || 'Failed to confirm transit.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmArrival = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/worker-arrive/`);
      setSuccessMsg('Arrival at customer location confirmed!');
      loadJobDetails();
    } catch (err) {
      setError(err.message || 'Failed to confirm arrival.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportDelay = async (e) => {
    e.preventDefault();
    if (!delayReason.trim()) {
      setError('Please provide a reason for the delay.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/worker-delay/`, {
        reason: delayReason.trim(),
        estimated_minutes: parseInt(delayEstMinutes, 10) || 15
      });
      setShowDelayModal(false);
      setSuccessMsg('Delay reported to customer.');
      loadJobDetails();
    } catch (err) {
      setError(err.message || 'Failed to report delay.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWork = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/start-work/`);
      setSuccessMsg('Work status updated to IN PROGRESS!');
      loadJobDetails();
    } catch (err) {
      setError(err.message || 'Failed to start work.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteWork = async () => {
    setActionLoading(true);
    setError('');
    try {
      await api.post(`/api/bookings/${id}/complete/`);
      setSuccessMsg('Job successfully marked as COMPLETED!');
      loadJobDetails();
    } catch (err) {
      setError(err.message || 'Failed to complete work.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Loading job details..." />;
  }

  if (!booking) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2>Job Not Found</h2>
        <button onClick={() => navigate('/worker/dashboard')} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const latestQuote = quotations[0] || null;
  const canSubmitQuote = !latestQuote || latestQuote.status === 'DECLINED';
  const canStartWork = booking.status === 'QUOTE_ACCEPTED';
  const canCompleteWork = booking.status === 'IN_PROGRESS';

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          onClick={() => navigate('/worker/dashboard')}
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Assigned Job <strong style={{ color: 'var(--brand-navy)' }}>#{String(booking.id).slice(0, 8)}</strong>
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
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {/* Main Full-Width Header Card */}
      <div className="card" style={{ padding: '1.75rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--brand-blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Assigned Job #{String(booking.id).slice(0, 8)}
            </span>
            <h1 style={{ fontSize: '1.85rem', color: 'var(--brand-navy)', marginTop: '0.2rem', marginBottom: '0.35rem' }}>
              {booking.service_name || 'Service Assignment'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, maxWidth: '800px', lineHeight: 1.5 }}>
              {booking.problem_description}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>
      </div>

      {/* Two-Column Responsive Split Layout */}
      <div className="layout-split">
        {/* Main Work Column: Execution Controls & Quotation Builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {/* Worker Transit & Arrival Bar */}
          {['ASSIGNED', 'QUOTE_PENDING', 'QUOTE_ACCEPTED'].includes(booking.status) && (
            <div className="card" style={{ padding: '1.5rem 2rem', background: 'var(--brand-pale)', border: '1px solid rgba(8, 127, 186, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <Navigation size={18} style={{ color: 'var(--brand-blue)' }} /> Travel &amp; Arrival Status:
                    <span className="badge badge-info">{booking.travel_status || 'NOT_STARTED'}</span>
                  </h4>
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {booking.travel_status === 'HEADING_TO_JOB' && 'Customer sees you en route. Confirm arrival when you reach the customer location.'}
                    {booking.travel_status === 'ARRIVED' && 'Arrival confirmed. Please inspect and proceed with quotation or customer approval.'}
                    {booking.travel_status === 'DELAYED' && `Delay reported: ${booking.delay_reason} (~${booking.estimated_arrival_minutes || 15} mins)`}
                    {(!booking.travel_status || booking.travel_status === 'NOT_STARTED') && 'Update transit status to keep customer notified.'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {(!booking.travel_status || booking.travel_status === 'NOT_STARTED') && (
                    <button onClick={handleConfirmHeading} className="btn btn-primary btn-sm" disabled={actionLoading}>
                      <Navigation size={14} /> I'm Heading to Job
                    </button>
                  )}
                  {booking.travel_status !== 'ARRIVED' && (
                    <button onClick={handleConfirmArrival} className="btn btn-secondary btn-sm" disabled={actionLoading}>
                      <CheckCircle2 size={14} /> Confirm Arrival
                    </button>
                  )}
                  {booking.travel_status !== 'ARRIVED' && (
                    <button onClick={() => setShowDelayModal(true)} className="btn btn-secondary btn-sm" disabled={actionLoading}>
                      <Clock size={14} /> Report Delay
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Work Execution Control Bar */}
          <div className="card" style={{ padding: '1.75rem 2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.75rem', color: 'var(--brand-navy)' }}>
              Job Lifecycle &amp; Work Execution
            </h3>

            {booking.status === 'ASSIGNED' && (
              <p style={{ fontSize: '0.9rem', color: 'var(--warning)', fontWeight: 600, margin: 0 }}>
                Next Step: Inspect customer requirements and submit an itemized quotation below for customer approval.
              </p>
            )}

            {booking.status === 'QUOTE_PENDING' && (
              <p style={{ fontSize: '0.9rem', color: 'var(--brand-blue)', fontWeight: 600, margin: 0 }}>
                Quotation submitted. Waiting for customer acceptance.
              </p>
            )}

            {canStartWork && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'var(--success-bg)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)' }}>
                <div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--success)', fontWeight: 700, margin: 0 }}>
                    Customer accepted quotation! You are authorized to begin work.
                  </p>
                </div>
                <button
                  onClick={handleStartWork}
                  className="btn btn-primary btn-lg"
                  disabled={actionLoading}
                >
                  <Play size={18} /> Start Work Now
                </button>
              </div>
            )}

            {canCompleteWork && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'var(--brand-pale)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(8, 127, 186, 0.25)' }}>
                <div>
                  <p style={{ fontSize: '0.95rem', color: 'var(--brand-navy)', fontWeight: 700, margin: 0 }}>
                    Work is actively IN PROGRESS
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                    Once repairs and inspection are finished, mark this job as completed.
                  </p>
                </div>
                <button
                  onClick={handleCompleteWork}
                  className="btn btn-primary btn-lg"
                  disabled={actionLoading}
                >
                  <CheckCircle2 size={18} /> Mark Work Completed
                </button>
              </div>
            )}

            {booking.status === 'COMPLETED' && (
              <div style={{ background: 'var(--success-bg)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-border)', color: 'var(--success)', fontWeight: 700 }}>
                ✓ Service job successfully completed and closed.
              </div>
            )}
          </div>

          {/* Quotation Management Section */}
          <div className="card" style={{ padding: '1.75rem 2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Receipt size={20} style={{ color: 'var(--brand-blue)' }} /> Quotation Management
              </h3>
              {latestQuote && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-info">Revision {latestQuote.revision_number}</span>
                  <StatusBadge status={latestQuote.status} />
                </div>
              )}
            </div>

            {/* Existing Quotation View */}
            {latestQuote && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem', lineHeight: 1.5, background: 'var(--bg-main)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <strong>Scope Description:</strong> {latestQuote.work_description}
                </p>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-navy)', marginBottom: '0.5rem' }}>
                  Authoritative Total: <span style={{ color: 'var(--brand-blue)' }}>₹{latestQuote.total_amount}</span>
                </div>

                {latestQuote.status === 'DECLINED' && (
                  <div style={{ marginTop: '0.75rem', padding: '0.85rem 1rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.875rem' }}>
                    Customer feedback: {latestQuote.customer_notes || 'Revision requested.'} You may prepare and submit a revised quote below.
                  </div>
                )}
              </div>
            )}

            {/* Quotation Submission Form */}
            {canSubmitQuote && (
              <form onSubmit={handleSubmitQuotation} style={{ borderTop: latestQuote ? '1.5px solid var(--border-subtle)' : 'none', paddingTop: latestQuote ? '1.25rem' : '0' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--brand-navy)' }}>
                  {latestQuote ? 'Submit Revised Quotation' : 'Prepare Itemized Quotation'}
                </h4>

                <div className="form-group">
                  <label className="form-label">Scope / Work Description *</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Detail what parts, labor, diagnostics, and repairs will be carried out..."
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>Itemized Charges *</label>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="btn btn-secondary btn-sm"
                    >
                      <Plus size={14} /> Add Line Item
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(110px, 1.2fr) minmax(160px, 2.5fr) minmax(65px, 0.8fr) minmax(90px, 1.2fr) 36px',
                          gap: '0.5rem',
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                          minWidth: '480px'
                        }}
                      >
                        <select
                          className="form-control"
                          value={item.item_type}
                          onChange={(e) => handleItemChange(idx, 'item_type', e.target.value)}
                        >
                          <option value="LABOR">Labor</option>
                          <option value="MATERIAL">Material</option>
                          <option value="OTHER">Other</option>
                        </select>

                        <input
                          type="text"
                          className="form-control"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          required
                        />

                        <input
                          type="number"
                          min="1"
                          className="form-control"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          required
                        />

                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          placeholder="Rate"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          required
                        />

                        {items.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}
                            aria-label="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginBottom: '1.25rem', fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-navy)' }}>
                  Calculated Total: <span style={{ color: 'var(--brand-blue)' }}>₹{calculatePreviewTotal()}</span>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Submitting Quotation...' : 'Submit Quotation for Customer Review'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Sidebar Column: Customer Location & Navigation */}
        <div className="layout-sidebar sticky">
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '1rem', margin: 0, color: 'var(--brand-navy)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                <MapPin size={18} style={{ color: 'var(--brand-blue)' }} /> Customer Location
              </h4>
              {booking.service_latitude && booking.service_longitude && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${booking.service_latitude},${booking.service_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                >
                  <Navigation size={13} /> Directions &rarr;
                </a>
              )}
            </div>

            <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--brand-navy)', margin: '0 0 0.25rem' }}>
              {booking.service_address_title ? `${booking.service_address_title}` : 'Service Address'}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.75rem' }}>
              {booking.service_address_line}
              {booking.service_landmark && `, Near ${booking.service_landmark}`}
              <br />
              {booking.service_city} - {booking.service_pincode}
            </p>

            {booking.service_latitude && booking.service_longitude && (
              <LocationPickerMap
                latitude={parseFloat(booking.service_latitude)}
                longitude={parseFloat(booking.service_longitude)}
                readOnly={true}
                height="240px"
              />
            )}
          </div>
        </div>
      </div>

      {/* Delay Modal */}
      {showDelayModal && (
        <div className="modal-backdrop" onClick={() => setShowDelayModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--brand-navy)' }}>Report Transit Delay</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Inform the customer about your expected delay so they are aware of your updated schedule.
            </p>
            <form onSubmit={handleReportDelay}>
              <div className="form-group">
                <label className="form-label">Delay Explanation *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="e.g. Heavy traffic on Avinashi Road or prior service overrun..."
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Estimated Additional Minutes</label>
                <select
                  className="form-control"
                  value={delayEstMinutes}
                  onChange={(e) => setDelayEstMinutes(e.target.value)}
                >
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDelayModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Reporting...' : 'Send Delay Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
