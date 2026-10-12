import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Plus, Send, CheckCircle2, AlertCircle, Wrench, ShieldCheck, Clock } from 'lucide-react';
import { api } from '../../api/client';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import LocationPickerMap from '../../components/map/LocationPickerMap';

const COIMBATORE_PRESETS = [
  { area: 'Gandhipuram', lat: 11.0168, lon: 76.9558, pin: '641012' },
  { area: 'RS Puram', lat: 11.0085, lon: 76.9450, pin: '641002' },
  { area: 'Peelamedu', lat: 11.0250, lon: 76.9950, pin: '641004' },
  { area: 'Saibaba Colony', lat: 11.0300, lon: 76.9400, pin: '641011' },
  { area: 'Singanallur', lat: 10.9980, lon: 77.0200, pin: '641005' },
];

export default function CreateBooking() {
  const [searchParams] = useSearchParams();
  const preselectedServiceId = searchParams.get('service');

  const [services, setServices] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(preselectedServiceId || '');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [problemDescription, setProblemDescription] = useState('');

  // New Address Form State
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    title: 'Home',
    address_line1: '',
    address_line2: '',
    landmark: '',
    city: 'Coimbatore',
    pincode: '641012',
    latitude: 11.0168,
    longitude: 76.9558
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      const [servicesData, addressesData] = await Promise.all([
        api.get('/api/services/catalog/'),
        api.get('/api/auth/customer/addresses/')
      ]);

      const serviceList = Array.isArray(servicesData) ? servicesData : (servicesData?.results || []);
      const addressList = Array.isArray(addressesData) ? addressesData : (addressesData?.results || []);
      setServices(serviceList);
      setAddresses(addressList);

      if (addressList.length > 0) {
        setSelectedAddressId(String(addressList[0].id));
      } else {
        setShowNewAddress(true);
      }

      if (preselectedServiceId) {
        setSelectedServiceId(String(preselectedServiceId));
      } else if (serviceList.length > 0) {
        setSelectedServiceId(String(serviceList[0].id));
      }
    } catch (err) {
      setError(err.message || 'Failed to load services or addresses.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const created = await api.post('/api/auth/customer/addresses/', newAddress);
      setAddresses((prev) => [...prev, created]);
      setSelectedAddressId(created.id);
      setShowNewAddress(false);
      setNewAddress({
        title: 'Home',
        address_line1: '',
        address_line2: '',
        landmark: '',
        city: 'Coimbatore',
        pincode: '641012',
        latitude: 11.0168,
        longitude: 76.9558
      });
    } catch (err) {
      setError(err.message || 'Failed to save address.');
    }
  };

  const handleMapCoordinateChange = ({ latitude, longitude }) => {
    setNewAddress((prev) => ({
      ...prev,
      latitude,
      longitude
    }));
  };

  const handleApplyPreset = (preset) => {
    setNewAddress((prev) => ({
      ...prev,
      latitude: preset.lat,
      longitude: preset.lon,
      pincode: preset.pin,
      landmark: preset.area
    }));
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!selectedServiceId) {
      setError('Please select a service.');
      return;
    }
    if (!selectedAddressId) {
      setError('Please select or add a service address in Coimbatore.');
      return;
    }
    if (!problemDescription.trim() || problemDescription.trim().length < 10) {
      setError('Please provide a description of the issue (at least 10 characters).');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const response = await api.post('/api/bookings/', {
        service_id: parseInt(selectedServiceId, 10),
        address_id: parseInt(selectedAddressId, 10),
        problem_description: problemDescription.trim()
      });

      const booking = response.booking || response;
      setFeedback(response.message || 'Booking created successfully!');

      setTimeout(() => {
        navigate(`/customer/bookings/${booking.id}`);
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to create booking.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage message="Preparing booking service..." />;
  }

  const selectedService = services.find((s) => String(s.id) === String(selectedServiceId));
  const selectedAddress = addresses.find((a) => String(a.id) === String(selectedAddressId));

  return (
    <div className="layout-full" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--brand-blue)', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
          <span>Home 2 Service Marketplace</span>
        </div>
        <h1 style={{ fontSize: '1.95rem', color: 'var(--brand-navy)', marginBottom: '0.35rem' }}>
          Book a Local Service
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
          Submit your service requirements. Verified professionals within a 5 km Coimbatore radius will receive your job offer.
        </p>
      </div>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1.1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            fontWeight: 600
          }}
        >
          <CheckCircle2 size={22} />
          <span>{feedback}</span>
        </div>
      )}

      <form onSubmit={handleSubmitBooking}>
        <div className="layout-split">
          {/* Main Column: Interactive Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Step 1: Select Service */}
            <div className="card" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-navy)' }}>
                <Wrench size={18} style={{ color: 'var(--brand-blue)' }} /> 1. Select Service Category
              </h3>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Service Type *</label>
                <select
                  className="form-control"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  required
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.category_name ? `${s.category_name} — ` : ''}{s.name} (Base: ₹{s.base_price})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 2: Service Location */}
            <div className="card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-navy)', margin: 0 }}>
                  <MapPin size={18} style={{ color: 'var(--brand-blue)' }} /> 2. Service Address (Coimbatore)
                </h3>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowNewAddress(!showNewAddress)}
                >
                  <Plus size={14} /> {showNewAddress ? 'Select Existing Address' : 'Add New Address'}
                </button>
              </div>

              {!showNewAddress ? (
                <div>
                  {addresses.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No saved addresses found. Please add an address below.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {addresses.map((addr) => (
                        <label
                          key={addr.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.85rem',
                            padding: '1rem 1.25rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1.5px solid',
                            borderColor: String(selectedAddressId) === String(addr.id) ? 'var(--brand-blue)' : 'var(--border-subtle)',
                            background: String(selectedAddressId) === String(addr.id) ? 'var(--brand-pale)' : 'var(--bg-surface)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-fast)'
                          }}
                        >
                          <input
                            type="radio"
                            name="selectedAddress"
                            value={addr.id}
                            checked={String(selectedAddressId) === String(addr.id)}
                            onChange={() => setSelectedAddressId(String(addr.id))}
                            style={{ marginTop: '3px', accentColor: 'var(--brand-blue)' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <strong style={{ fontSize: '0.95rem', color: 'var(--brand-navy)' }}>{addr.title}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ({parseFloat(addr.latitude).toFixed(4)}, {parseFloat(addr.longitude).toFixed(4)})
                              </span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                              {addr.address_line1}
                              {addr.address_line2 ? `, ${addr.address_line2}` : ''}
                              {addr.landmark ? ` (Near ${addr.landmark})` : ''}, {addr.city} - {addr.pincode}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* New Address Entry with Interactive Map */
                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--brand-navy)', marginBottom: '0.75rem' }}>
                    Pinpoint New Address in Coimbatore
                  </h4>

                  <div style={{ marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                      Quick Coimbatore Presets:
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {COIMBATORE_PRESETS.map((p) => (
                        <button
                          key={p.area}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                          onClick={() => handleApplyPreset(p)}
                        >
                          {p.area}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Map Picker */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <LocationPickerMap
                      initialLat={newAddress.latitude}
                      initialLon={newAddress.longitude}
                      onLocationSelect={handleMapCoordinateChange}
                      height="260px"
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Address Title</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddress.title}
                        onChange={(e) => setNewAddress({ ...newAddress, title: e.target.value })}
                        placeholder="e.g. Home, Office, Saibaba Colony Flat"
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Landmark / Area</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddress.landmark}
                        onChange={(e) => setNewAddress({ ...newAddress, landmark: e.target.value })}
                        placeholder="e.g. Near Cross-Cut Road"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Address Line *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newAddress.address_line1}
                      onChange={(e) => setNewAddress({ ...newAddress, address_line1: e.target.value })}
                      placeholder="Door No, Building Name, Street..."
                      required
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">City</label>
                      <input type="text" className="form-control" value={newAddress.city} readOnly />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Pincode</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newAddress.pincode}
                        onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewAddress(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateAddress}>
                      Save Address
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Problem Description */}
            <div className="card" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--brand-navy)' }}>
                3. Describe the Problem
              </h3>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Issue Details &amp; Specific Requirements *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Describe what needs repair or servicing (e.g. Major leakage under kitchen sink, pipe connection broken, urgent repair needed)..."
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Sidebar Column: Sticky Booking Summary & Confirmation */}
          <div className="layout-sidebar sticky">
            <div className="card" style={{ padding: '1.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--brand-navy)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                Booking Summary
              </h3>

              {/* Service details */}
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Selected Service
                </span>
                <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-navy)', margin: '0.2rem 0' }}>
                  {selectedService ? selectedService.name : 'Select a service'}
                </p>
                {selectedService && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Starting base price: <strong style={{ color: 'var(--brand-navy)' }}>₹{selectedService.base_price}</strong>
                  </span>
                )}
              </div>

              {/* Address details */}
              <div style={{ marginBottom: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Destination Address
                </span>
                {selectedAddress ? (
                  <div style={{ marginTop: '0.25rem' }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--brand-navy)', margin: 0 }}>
                      {selectedAddress.title}
                    </p>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0', lineHeight: 1.4 }}>
                      {selectedAddress.address_line1}, {selectedAddress.city} - {selectedAddress.pincode}
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Please select or add an address
                  </p>
                )}
              </div>

              {/* Safeguards note */}
              <div
                style={{
                  background: 'var(--brand-pale)',
                  border: '1px solid rgba(8, 127, 186, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  fontSize: '0.825rem',
                  color: 'var(--brand-navy)',
                  lineHeight: 1.5
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--brand-blue)' }}>
                  <ShieldCheck size={16} /> Home 2 Service Safeguard
                </div>
                Broadcasts to verified professionals within <strong>5.0 km</strong>. First valid acceptance wins. Quotation review required before work starts.
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={submitting || !selectedAddressId || !problemDescription.trim()}
              >
                <Send size={18} /> {submitting ? 'Broadcasting Request...' : 'Confirm & Request Worker'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
