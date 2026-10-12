# MultiWork — System Architecture & Design Specification

## 1. Architectural Philosophy

MultiWork is implemented as a **Clean Modular Monolith** combining:
- **Backend:** Python / Django 5+ with Django REST Framework (DRF) running with PostgreSQL.
- **Frontend:** React 19 / Vite + TypeScript Single-Page Application (SPA) with Leaflet mapping and mobile-first responsive Vanilla/Utility CSS styling.
- **Real-Time Strategy:** High-efficiency HTTP client-side polling (interval: 3–5 seconds during active broadcast offer windows) avoiding premature WebSocket and Redis/Celery operational complexity while guaranteeing state consistency from the authoritative PostgreSQL database.

```
+-------------------------------------------------------------------------+
|                              MultiWork SPA                              |
|                    (React + Vite + Leaflet + TypeScript)                 |
+--------------------+---------------------+------------------------------+
                     |                     |
                     | JSON / REST (JWT)   | Polling / State Updates
                     v                     v
+-------------------------------------------------------------------------+
|                       Django REST Framework Core                        |
|                                                                         |
|  [accounts]      [services]      [bookings]     [quotations]  [notifs]  |
|  - Custom User   - Categories    - Dispatcher   - Quotes      - In-app  |
|  - WorkerProfile - Service List  - Concurrency  - Approval    - Events  |
|  - Permissions   - Coverage Area - State Mach.  - Auditing              |
+-------------------------------------------------------------------------+
                                   |
                                   | Django ORM + PostGIS / Haversine
                                   v
+-------------------------------------------------------------------------+
|                         PostgreSQL 18 Database                          |
|         - Row-level Locking (SELECT ... FOR UPDATE)                     |
|         - Precise Decimal arithmetic for currency                       |
|         - Spatial/Coordinate indexing for 5km radius matching           |
+-------------------------------------------------------------------------+
```

---

## 2. Backend Module Structure

The backend is partitioned into focused Django applications:

1. **`accounts`**:
   - `User`: Custom user model inheriting `AbstractUser` with `role` (`CUSTOMER`, `WORKER`, `ADMIN`), phone number, and avatar.
   - `WorkerProfile`: Verification documents, approval status (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`), active status, current lat/long, and service radius.
   - `Address`: Reusable customer service addresses with coordinates and Coimbatore boundary verification.

2. **`services`**:
   - `ServiceCategory`: Categorization (e.g., Plumbing, Electrician).
   - `Service`: Discrete service listings with base pricing guidelines.
   - `WorkerService`: Many-to-many relationship linking workers to their qualified services, custom hourly/visit rates, and years of experience.

3. **`bookings`**:
   - `Booking`: Primary service request and engagement state machine.
   - `WorkerOffer`: Represents a broadcast dispatched to an eligible worker with 60-second validity and concurrency control.
   - Concurrency Manager: Uses `select_for_update()` inside atomic database transactions to guarantee only one worker can accept a booking.

4. **`quotations`**:
   - `Quotation`: Detailed quote created by the assigned worker containing itemized labor, parts, estimated hours, and total decimal amount.
   - Lifecycle: `DRAFT` -> `SENT` -> `ACCEPTED` / `DECLINED` / `EXPIRED`.

5. **`notifications`**:
   - `Notification`: In-app persistent event logs for customers and workers with read/unread tracking.

---

## 3. Location & Radius Matching Design

- **Coverage Boundary:** Coimbatore urban region (approx. Lat: 10.9000 to 11.1500 N, Lon: 76.8500 to 77.1000 E).
- **Distance Calculation:** High-performance Haversine spherical formula implemented at the database query level or PostGIS geometry.
- **Privacy Barrier:** When a booking is in the `SEARCHING` broadcast state, only the customer's general locality and distance (e.g., "RS Puram - 2.4 km away") is displayed to candidates. The specific flat/house number and exact coordinate are revealed exclusively to the worker whose acceptance is confirmed.

---

## 4. Concurrency & Broadcast Dispatch Flow

1. Customer submits a booking request for a service with location coordinates.
2. System queries for workers matching:
   - `user.role == 'WORKER'`
   - `worker_profile.approval_status == 'APPROVED'`
   - `worker_profile.is_available == True`
   - `worker_profile.is_active == True`
   - Offers the requested service
   - Distance <= 5.0 km
3. System creates a `WorkerOffer` record for each matched worker with `expires_at = now() + 60 seconds`.
4. Notifications are created for all recipients.
5. When Worker A accepts:
   - DB transaction begins: `Booking` and `WorkerOffer` rows are locked via `select_for_update()`.
   - Checks: Is booking still in `SEARCHING`? Is `WorkerOffer` still `PENDING`? Has 60 seconds passed?
   - If valid: Worker A is assigned; booking becomes `ASSIGNED`; all other offers for this booking are immediately marked `MISSED`/`EXPIRED`.
   - If Worker B attempts acceptance milliseconds later: The lock blocks Worker B, then Worker B reads the updated booking state (`ASSIGNED`) and receives an HTTP 409 Conflict with an informative message.
