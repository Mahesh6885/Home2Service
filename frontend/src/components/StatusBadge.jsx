import React from 'react';

const STATUS_CONFIG = {
  // Booking statuses
  REQUESTED: { label: 'Requested', variant: 'info' },
  SEARCHING: { label: 'Finding Workers', variant: 'warning' },
  ASSIGNED: { label: 'Worker Assigned', variant: 'info' },
  QUOTE_PENDING: { label: 'Quotation Pending', variant: 'warning' },
  QUOTE_ACCEPTED: { label: 'Quotation Accepted', variant: 'success' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'danger' },
  EXPIRED: { label: 'Expired', variant: 'neutral' },

  // Offer statuses
  PENDING: { label: 'Pending', variant: 'warning' },
  ACCEPTED: { label: 'Accepted', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  MISSED: { label: 'Missed', variant: 'neutral' },

  // Worker approval statuses
  APPROVED: { label: 'Approved', variant: 'success' },

  // Quotation statuses
  DECLINED: { label: 'Declined', variant: 'danger' },
  SUPERSEDED: { label: 'Superseded', variant: 'neutral' },
};

export default function StatusBadge({ status, customLabel }) {
  const config = STATUS_CONFIG[status] || { label: status || 'Unknown', variant: 'neutral' };
  const label = customLabel || config.label;

  return (
    <span className={`badge badge-${config.variant}`}>
      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  );
}
