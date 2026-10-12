import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ConfirmationModal from '../components/ConfirmationModal';
import CountdownTimer from '../components/CountdownTimer';

describe('Frontend UI Components', () => {
  it('renders StatusBadge with correct labels and styles for bookings', () => {
    const { rerender } = render(<StatusBadge status="REQUESTED" />);
    expect(screen.getByText('Requested')).toBeDefined();

    rerender(<StatusBadge status="SEARCHING" />);
    expect(screen.getByText('Finding Workers')).toBeDefined();

    rerender(<StatusBadge status="QUOTE_ACCEPTED" />);
    expect(screen.getByText('Quotation Accepted')).toBeDefined();

    rerender(<StatusBadge status="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('renders StatusBadge for worker profile approval states', () => {
    const { rerender } = render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('Pending')).toBeDefined();

    rerender(<StatusBadge status="APPROVED" />);
    expect(screen.getByText('Approved')).toBeDefined();

    rerender(<StatusBadge status="REJECTED" />);
    expect(screen.getByText('Rejected')).toBeDefined();
  });

  it('renders LoadingSpinner with custom message', () => {
    render(<LoadingSpinner message="Locating available Coimbatore workers..." />);
    expect(screen.getByText('Locating available Coimbatore workers...')).toBeDefined();
  });

  it('renders ErrorMessage with retry and dismiss options', () => {
    const retryAction = vi.fn();
    const onDismiss = vi.fn();
    render(<ErrorMessage message="Unable to load catalog" retryAction={retryAction} onDismiss={onDismiss} />);

    expect(screen.getByText('Unable to load catalog')).toBeDefined();
    
    const retryBtn = screen.getByText('Try again');
    fireEvent.click(retryBtn);
    expect(retryAction).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByLabelText('Dismiss');
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders ConfirmationModal and triggers confirm action', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmationModal
        isOpen={true}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking?"
        confirmText="Confirm Cancel"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Cancel Booking')).toBeDefined();
    expect(screen.getByText('Are you sure you want to cancel this booking?')).toBeDefined();

    const confirmBtn = screen.getByText('Confirm Cancel');
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders CountdownTimer and notifies on expiry', () => {
    const onExpire = vi.fn();
    // Expiry in past
    const pastTime = new Date(Date.now() - 5000).toISOString();
    render(<CountdownTimer expiresAt={pastTime} onExpire={onExpire} />);

    expect(screen.getByText('Offer Expired')).toBeDefined();
    expect(onExpire).toHaveBeenCalled();
  });
});
