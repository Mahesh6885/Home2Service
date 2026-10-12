# MultiWork — Phased Implementation Plan

**Target Handover Date:** 20 October 2026  
**Execution Strategy:** Incremental milestones with strict verification before progression.

---

## Milestone Breakdown & Schedule

### Milestone 1: Workspace & Documentation (11 Oct 2026) — *In Progress*
- [x] Workspace environment inspection (Python 3.14, Node v24, PostgreSQL 18).
- [x] PostgreSQL database initialization (`multiwork_db`).
- [x] Project architecture & requirements artifacts (`REQUIREMENTS.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `IMPLEMENTATION_PLAN.md`, `TEST_PLAN.md`, `RISK_REGISTER.md`, `README.md`).

### Milestone 2: Django Core, Custom User & Authentication (11–12 Oct 2026) — *Completed*
- [x] Django 5+ project configuration with PostgreSQL database connection and settings separation.
- [x] Implement `accounts` app: Custom `User` model with roles (`CUSTOMER`, `WORKER`, `ADMIN`), phone number, and avatar.
- [x] Implement `WorkerProfile` model with `approval_status`, documents, location coordinates.
- [x] Implement `Address` model for Coimbatore service locations.
- [x] Execute initial database migrations.
- [x] JWT authentication endpoints (Register, Login, Refresh, Me).
- [x] Role permission classes (`IsCustomer`, `IsWorker`, `IsAdmin`, `IsApprovedWorker`).
- [x] Secure admin initialization management command (`createsuperadmin`).
- [x] Automated tests for registration, authentication, and role authorization.

### Milestone 3: Service Catalog & Worker Management (13–14 Oct 2026) — *Completed*
- [x] Implement `services` app: `ServiceCategory`, `Service`, `WorkerService`.
- [x] Admin CRUD endpoints for service categories and services.
- [x] Worker service selection, experience, and custom pricing endpoints.
- [x] Worker profile completion, document upload, and Admin verification queue.
- [x] Admin worker approval/rejection endpoints with audit notes.
- [x] Worker availability toggle (`is_available`).
- [x] Seed script for Coimbatore service categories (`seed_service_catalog` / `seed_services`).
- [x] Automated tests for service catalog and worker offerings (14 new test cases, 21 total passing).

### Milestone 4: Coimbatore Location Matching & Broadcast Dispatch (14–15 Oct 2026) — *Completed*
- [x] Coimbatore geographic boundary validation (lat/long bounding box).
- [x] Haversine 5 km radius calculation query.
- [x] Booking creation endpoint (`bookings` app) and validation.
- [x] Broadcast dispatch logic: locate eligible nearby workers, generate `WorkerOffer` records with 60-second timeouts.
- [x] Worker offer inbox and polling endpoint.
- [x] Atomic acceptance mechanism with `select_for_update()` row locking.
- [x] Invalidation of competing worker offers on winning acceptance.
- [x] 60-second expiry handling and customer retry flow.
- [x] Concurrency and race-condition automated test suite (16 tests, PostgreSQL TransactionTestCase verified, 37 total passing).

### Milestone 5: Quotation Workflow & Booking State Machine (16 Oct 2026) — *Completed*
- [x] Implement `quotations` app: `Quotation` and `QuotationItem` models with decimal-safe calculations and revision tracking.
- [x] Worker quotation submission & revision endpoint (enforced strictly for assigned worker; previous pending quotes superseded for audit).
- [x] Customer quotation review endpoints (`ACCEPT` / `DECLINE`).
- [x] Core invariant strictly enforced: Work can NEVER begin without customer quotation acceptance (`/api/bookings/<id>/start-work/`).
- [x] Server-authoritative monetary calculations: itemized line calculations eliminate double counting.
- [x] Automated tests for quotation lifecycle, authorization, and multi-threaded PostgreSQL concurrency (18 new tests, 55 total passing).

### Milestone 6: Persistent In-App Notifications & Audit (16–17 Oct 2026)
- [x] Implement `apps.notifications`: persistent `Notification` and append-only `AuditEvent` models in PostgreSQL.
- [x] Explicit service-layer triggers wired to authoritative transactions (dispatch, offers, quotations, work-start, complete, cancel, worker approval).
- [x] Composite database indexes for high-throughput recipient inbox sorting (`[recipient, -created_at]`) and unread status (`[recipient, is_read]`).
- [x] Polling-friendly HTTP endpoints: list with pagination/filter (`GET /api/notifications/`), unread count (`GET /api/notifications/unread-count/`), mark read (`POST /api/notifications/<id>/read/`), and mark all read (`POST /api/notifications/read-all/`).
- [x] Privacy safeguards: strict recipient scoping with 404 for unauthorized notification access, admin-only audit inspection (`GET /api/admin/audit-events/`).
- [x] Idempotency keys preventing duplicate alerts upon client retries; metadata sanitization stripping credentials and sensitive identity attributes.
- [x] Automated tests for notification API privacy, lifecycle triggers, metadata sanitization, and multi-threaded race conditions (21 new tests, 76 total passing).

### Milestone 7: React Frontend & Role Dashboards (17–18 Oct 2026) — *Completed*
- [x] React 19 + Vite setup in `frontend/` with clean architecture and zero external state management bloat.
- [x] Design system: modern responsive CSS, curated dark-mode theme, glassmorphism, responsive utilities, and status badge variants (`index.css`).
- [x] Role-based routes & authentication context (`AuthContext`, `ProtectedRoute`) with safe JWT refresh.
- [x] Customer flow: public service catalog (`ServiceCatalog`), booking creation with Coimbatore address selector (`CreateBooking`), quotation review & approval (`BookingDetail`), and dashboard (`CustomerDashboard`, `CustomerBookings`).
- [x] Worker flow: registration (`Register`), dashboard with verification alerts (`WorkerDashboard`), availability toggle, incoming broadcast offer queue with 60s countdown timer (`WorkerOffers`), service offerings manager (`WorkerServices`), itemized quotation creation/revision, and invariant-protected work start and completion (`WorkerJobDetail`).
- [x] Admin portal: worker verification queue with approve/reject actions (`WorkerApprovalQueue`), catalog manager (`AdminCatalog`), booking monitor (`AdminBookings`), and immutable audit inspection (`AdminAuditEvents`).
- [x] Persistent in-app notifications: unread-count badge with 30s background polling, interactive notification drawer, and full inbox (`CustomerNotifications`).
- [x] Production build verification (`npm run build` succeeds cleanly in 1.5s).
- [x] Frontend test suite implemented with Vitest and React Testing Library (14/14 tests passing).

### Milestone 8: Map Integration, GPS Access, Nearby Discovery & Live Tracking (18–19 Oct 2026) — *Completed*
- [x] Schema & Models: Added `last_location_updated_at` (default `now`) and `is_location_sharing_enabled` (default `True`) to `WorkerProfile`.
- [x] Candidate Discovery: Exclude stale locations (>60m) and paused sharing from the 5.0 km dispatch broadcast.
- [x] Worker GPS API: `POST /api/workers/me/location/` with 5-second server throttle and server-authoritative timestamps.
- [x] Customer Live Tracking: `GET /api/bookings/<uuid>/tracking/` with Haversine distance, stale detection (>15m), and privacy controls (unavailable before assignment, after completion/cancellation, or if worker paused).
- [x] Leaflet + OpenStreetMap: `LocationPickerMap` with draggable pin, GPS button, Nominatim reverse geocoding, and Coimbatore boundary validation.
- [x] Live Tracking Map: `WorkerLocationMap` with animated live pulse, route polyline, distance indicator, and status badge.
- [x] Worker Controls: `LocationSharingControl` on `WorkerDashboard` with background GPS sync and pause/resume toggle.
- [x] Automated Tests: 15 backend location & tracking tests (91 total backend passing); 8 map component unit tests (22 total frontend passing).
- [x] Production build verification: `npm run build` cleanly succeeded.

### Milestone 9: Handover, Deployment Guide & Verification (19–20 Oct 2026)
- [ ] Production deployment guide (Gunicorn/Uvicorn, PostgreSQL, Nginx/Caddy, Vite static build).
- [ ] Environment variable template (`.env.example`).
- [ ] Client demo script with pre-seeded test accounts and Coimbatore test addresses.
