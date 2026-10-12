# MultiWork — Comprehensive Test Plan

## 1. Test Strategy & Scope

The testing suite covers functional correctness, concurrency safety, geographic precision, permission boundaries, and state-machine transitions across the MultiWork application.

---

## 2. Test Suites Overview

### Suite A: Accounts & Authorization (`backend/apps/accounts/tests/`)
- `test_user_registration`: Customer and Worker registration validation.
- `test_custom_user_roles`: Verification that `role` cannot be spoofed or escalated via update endpoints.
- `test_worker_profile_creation`: Automatic or manual `WorkerProfile` generation upon worker registration with `PENDING` initial state.
- `test_admin_approval`: Admin can approve, reject, and suspend workers; workers cannot toggle active/receive offers until approved.
- `test_secure_admin_command`: Admin accounts cannot be registered publicly.
- `test_jwt_auth_flow`: Login, token refresh, and invalid token rejection.

### Suite B: Services Catalog (`backend/apps/services/tests/`)
- `test_service_crud_permissions`: Only Admin can add/edit/deactivate services.
- `test_worker_service_linking`: Approved workers can link offered services and define custom rates.
- `test_deactivated_service_filtering`: Deactivated services are not selectable by customers.

### Suite C: Location & Radius Matching (`backend/apps/bookings/tests/`)
- `test_coimbatore_boundary_validation`: Coordinates outside Coimbatore (e.g., Chennai or Bangalore) are flagged/rejected.
- `test_haversine_5km_filter`: Workers within 5.0 km are returned; workers at 5.1 km or beyond are excluded.
- `test_address_privacy`: Customer's specific flat/phone number is omitted in unassigned broadcast payloads.

### Suite D: Broadcast Dispatch & Concurrency (`backend/apps/bookings/tests/`)
- `test_broadcast_offer_creation`: Booking creation triggers offers only to eligible, approved, active, nearby workers.
- `test_60s_offer_expiration`: Offers older than 60 seconds cannot be accepted.
- `test_concurrent_worker_acceptance`: Two simultaneous acceptances simulated via multithreading/transactions; exactly ONE worker wins (`200 OK`), competing worker gets `409 Conflict`.
- `test_offer_cleanup_on_win`: All non-winning offers automatically transition to `MISSED`/`EXPIRED`.
- `test_customer_retry_on_timeout`: Customer can trigger search retry when all offers expire.

### Suite E: Quotation Workflow & State Transitions (`backend/apps/quotations/tests.py`)
- `test_assigned_worker_can_submit_valid_quotation`: Assigned worker submits quotation; totals calculated on server.
- `test_unassigned_worker_cannot_submit_quotation`: Unassigned worker rejected (HTTP 403).
- `test_customer_cannot_submit_quotation`: Customer rejected from submitting quotation (HTTP 403).
- `test_customer_can_view_own_quotation`: Customer views quotation and line items.
- `test_customer_cannot_access_another_customer_quotation`: Cross-customer privacy protection (HTTP 403).
- `test_total_is_calculated_strictly_on_server`: Client-tampered totals ignored; server calculates labor + materials + other.
- `test_negative_charges_rejected`: Negative prices and quantities rejected (HTTP 400).
- `test_itemized_line_calculations_are_authoritative`: Itemized lines calculated cleanly without double counting.
- `test_revised_quotation_supersedes_previous_and_preserves_history`: Revisions supersede previous pending quote; audit history preserved.
- `test_customer_can_accept_current_pending_quotation`: Transitions booking to `QUOTE_ACCEPTED`.
- `test_customer_can_decline_current_pending_quotation`: Transitions booking to `ASSIGNED` for revision.
- `test_second_response_cannot_change_finalized_quotation`: Finalized quotes cannot be toggled (HTTP 409).
- `test_old_or_superseded_quotations_cannot_be_accepted`: Superseded revisions rejected (HTTP 409).
- `test_work_cannot_start_without_customer_acceptance`: Core invariant: work blocked prior to customer acceptance (HTTP 409).
- `test_work_can_start_after_customer_acceptance`: Assigned worker starts work (`IN_PROGRESS`).
- `test_unrelated_worker_cannot_start_work`: Cross-worker authorization guard (HTTP 403).
- `test_cancelled_booking_cannot_submit_or_accept_quotations`: Closed bookings cannot proceed (HTTP 409).
- `test_concurrent_accept_and_decline_requests`: Multi-threaded PostgreSQL `TransactionTestCase` proving race safety.

### Suite F: Persistent In-App Notifications & Audit Logging (`backend/apps/notifications/tests.py`)
- `test_unauthenticated_cannot_access_notifications`: Unauthenticated requests to notification API return HTTP 401.
- `test_user_can_list_own_notifications`: Authenticated user lists only their own notifications ordered newest first.
- `test_unread_filtering`: Querying `?unread=true` filters down to unread notifications only.
- `test_unread_count_accurate`: Lightweight endpoint returns exact unread notification count.
- `test_mark_notification_as_read`: Marking notification as read updates status and sets timestamp.
- `test_repeated_mark_as_read_is_idempotent`: Idempotent repeated read calls preserve initial read timestamp.
- `test_user_cannot_read_or_mark_other_users_notification`: Cross-user privacy guard returns privacy-safe HTTP 404.
- `test_mark_all_read_affects_only_current_user`: Bulk mark-all-read updates only caller's notifications.
- `test_booking_dispatch_notifies_eligible_worker`: Broadcast creates `NEW_OFFER` notification for matching workers.
- `test_winning_assignment_notifies_winner_and_customer`: First acceptance triggers `OFFER_ACCEPTED` to worker and `WORKER_ASSIGNED` to customer.
- `test_no_workers_available_notifies_customer`: Dispatches with no nearby workers notify customer (`NO_WORKERS`).
- `test_quotation_submission_and_revision_notify_customer`: Submitting quote sends `QUOTATION_SUBMITTED`, revising sends `QUOTATION_REVISED`.
- `test_quotation_acceptance_and_decline_notify_worker`: Customer review responses trigger `QUOTATION_ACCEPTED` / `QUOTATION_DECLINED` alerts.
- `test_work_start_and_completion_notify_customer`: Lifecycle state transitions generate `WORK_STARTED` and `WORK_COMPLETED` alerts.
- `test_booking_cancellation_notifies_customer`: Customer cancellation triggers `BOOKING_CANCELLED` confirmation.
- `test_notification_idempotency_prevents_duplicates`: Unique `idempotency_key` guarantees no duplicate notifications upon retries.
- `test_sanitize_metadata_strips_sensitive_information`: Audit serializer strips passwords, tokens, full street lines, and secrets.
- `test_admin_can_list_and_filter_audit_events`: Administrator can inspect and filter immutable audit trail.
- `test_ordinary_users_cannot_access_or_modify_audit_events`: Customers and workers get HTTP 403 when requesting audit events.
- `test_failed_transactions_do_not_persist_notifications_or_audit`: Atomicity ensures rolled back transactions leave no ghost records.
- `test_concurrent_worker_acceptance_creates_exact_notifications`: Multi-threaded PostgreSQL race test ensures exactly one winner notification and one customer notification without contradictory records.

### Suite G: Frontend Automated & Integration Tests (`frontend/src/__tests__/`)
- `components.test.jsx`:
  - `StatusBadge` tests: verifies color variants, dot indicators, and status labels (`REQUESTED`, `SEARCHING`, `QUOTE_ACCEPTED`, `COMPLETED`, `PENDING`, `APPROVED`, `REJECTED`).
  - `LoadingSpinner`: verified animated spinner with contextual loading messages.
  - `ErrorMessage`: verified dismiss handler and retry callback actions.
  - `ConfirmationModal`: verified modal open/close controls and affirmative confirmation callbacks.
  - `CountdownTimer`: verified 60s visual timer, urgent threshold styling (<=15s), and immediate/interval expiry callback notifications.
- `auth.test.jsx`:
  - Token storage management: verifies secure storage fallback and token clearing.
  - Login form: verifies username/password inputs and submit handling.
  - AuthContext: verifies profile synchronization, role propagation (`CUSTOMER`, `WORKER`, `ADMIN`), and logout cleanup.
- `workflow_rules.test.jsx`:
  - Role-based route protection: verifies unauthorized role redirection (`Access Restricted` screen) and authorized role access.
  - Invariant enforcement: verifies `WorkerJobDetail` strictly blocks `Start Work Now` button when quotation is `QUOTE_PENDING`.
  - Authorized work start: verifies `WorkerJobDetail` displays and unlocks `Start Work Now` only after quotation is in `QUOTE_ACCEPTED` status.
  - Server-authoritative quotation breakdown: verifies `BookingDetail` displays server-calculated labor, material, other charges, line items, and total amount without client tampering.
- Production Build Verification:
  - `npm run build` executed and verified (0 errors, 2.15s build duration, CSS and JS chunks optimized).

### Suite H: Backend Location & Tracking Tests (`apps/bookings/tests_location_tracking.py`)
- `test_worker_can_update_location`: Approved worker can update GPS coordinates and location sharing preference.
- `test_worker_location_update_rate_limiting`: 5-second server-side throttle blocks rapid consecutive updates with HTTP 429.
- `test_worker_location_validation`: Rejects non-numeric or invalid coordinates.
- `test_unauthenticated_or_customer_cannot_update_worker_location`: Customers or unauthenticated callers get HTTP 403/401.
- `test_dispatch_excludes_workers_with_stale_location`: Workers with location older than 60 minutes are excluded from 5 km dispatch.
- `test_dispatch_excludes_workers_with_sharing_disabled`: Workers with `is_location_sharing_enabled=False` are excluded from dispatch.
- `test_dispatch_includes_active_nearby_worker`: Fresh worker within 5 km receives broadcast offer.
- `test_tracking_endpoint_requires_authentication`: Unauthenticated tracking requests return HTTP 401.
- `test_tracking_endpoint_denies_unauthorized_users`: Other customers get HTTP 403 on tracking endpoint.
- `test_tracking_endpoint_unavailable_before_assignment`: Returns `is_location_available=False` when booking is in `REQUESTED` or `SEARCHING`.
- `test_tracking_endpoint_available_for_assigned_customer`: Customer can track assigned worker in `ASSIGNED` status with distance in km.
- `test_tracking_endpoint_detects_stale_location`: Flags `is_stale=True` when worker location exceeds 15 minutes.
- `test_tracking_endpoint_detects_disabled_sharing`: Returns `is_location_available=False` with descriptive reason when worker pauses sharing.
- `test_tracking_endpoint_unavailable_after_completion`: Completed or cancelled bookings stop live tracking access.
- `test_assigned_worker_can_view_own_tracking`: Assigned worker can query tracking endpoint to verify route coordinates.

### Suite I: Frontend Map Components & Geolocation Tests (`frontend/src/__tests__/map_components.test.jsx`)
- `isWithinCoimbatoreRegion boundary helper`: Verifies Coimbatore bounding box validation against Gandhipuram, RS Puram, Peelamedu, Singanallur, and rejects out-of-bounds coordinates (Chennai, Bengaluru, London).
- `LocationStatusIndicator`: Verifies "Location Unavailable" badge, stale timestamp indicator (>15m), and live active green pulse badge.
- `CurrentLocationButton`: Verifies browser GPS acquisition via `navigator.geolocation`, error code mappings (permission denied, timeout, unavailable), and fallback UI messaging.

