# MultiWork — Coimbatore Multi-Service Booking Platform

MultiWork is a location-based multi-service marketplace designed for Coimbatore, Tamil Nadu, India. It connects customers needing local services (plumbers, electricians, mechanics, appliance technicians, cleaners) with nearby verified service professionals.

---

## Key Features

- **Role-Based Workflows:** Distinct, secure customer, worker, and administrator portals.
- **Worker Verification:** New professionals register and submit ID details, requiring Admin review and approval before receiving offers.
- **Location Matching:** Coimbatore geographic bounds with strict 5 km radius filtering.
- **Broadcast Dispatch:** Real-time job offers broadcast to eligible nearby workers with a 60-second expiration.
- **Atomic Assignment:** Concurrency-safe "first valid acceptance wins" assignment using PostgreSQL row locking (`select_for_update()`).
- **Server-Authoritative Quotations:** Itemized, quotation-based pricing agreed upon by customer before work commences; client-side price tampering blocked.
- **Invariant Enforcement:** Strict state transitions ensure work cannot begin until quotation is accepted.
- **Persistent In-App Notifications:** Lifecycle alerts for offers, status changes, quotations, and approvals with 30s background unread-count polling.
- **Modern Responsive Frontend:** React 19 + Vite SPA with curated dark-mode theme, glassmorphism, mobile-first layouts, and zero external state bloat.

---

## Technology Stack

- **Backend:** Python 3.14 / Django 6 / Django REST Framework
- **Database:** PostgreSQL 18
- **Authentication:** JWT (SimpleJWT) with silent refresh and role authorization
- **Frontend:** React 19 / Vite / React Router 7 / Lucide Icons
- **Testing:** Django Test Suite (PostgreSQL) + Vitest / React Testing Library

---

## Project Structure

```
d:/multiwork/
├── backend/
│   ├── manage.py
│   ├── multiwork_core/         # Project settings, wsgi, root urls, CORS
│   ├── apps/
│   │   ├── accounts/           # Custom User, WorkerProfile, Address
│   │   ├── services/           # ServiceCategory, Service, WorkerService
│   │   ├── bookings/           # Booking, WorkerOffer, Dispatch logic
│   │   ├── quotations/         # Quotation models and approval logic
│   │   └── notifications/      # In-app notifications & Audit logging
│   ├── requirements.txt
│   └── venv/                   # Python virtual environment
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── api/client.js       # Centralized API client with JWT refresh
│   │   ├── context/            # AuthContext and NotificationContext
│   │   ├── components/         # Navbar, StatusBadge, CountdownTimer, Modals
│   │   ├── pages/              # Customer, Worker, Admin, and Auth views
│   │   └── __tests__/          # Vitest unit & integration test suites
│   ├── .env.example            # Environment configuration template
│   └── vite.config.js          # Vite config with /api reverse proxy
├── REQUIREMENTS.md             # Project requirements and traceability
├── ARCHITECTURE.md             # Technical architecture
├── DATABASE_DESIGN.md          # ERD and schema specification
├── IMPLEMENTATION_PLAN.md      # Phased milestones
├── TEST_PLAN.md                # Automated test specifications
├── RISK_REGISTER.md            # Risk analysis and mitigations
└── README.md                   # Setup guide and instructions
```

---

## Setup & Running Locally (Windows PowerShell)

### 1. Database Setup
Ensure PostgreSQL is running locally on port 5432 with database `multiwork_db`:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE multiwork_db;"
```

### 2. Backend Setup
```powershell
cd d:\multiwork\backend

# Activate virtualenv
.\venv\Scripts\Activate.ps1

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create initial admin superuser (if needed)
python manage.py createsuperadmin --username admin --email admin@multiwork.local --password Admin@12345

# Seed initial Coimbatore service catalog
python manage.py seed_services

# Run backend automated tests (76 tests on PostgreSQL)
python manage.py test

# Start API server
python manage.py runserver 8000
```

### 3. Frontend Setup
```powershell
cd d:\multiwork\frontend

# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env (VITE_API_BASE_URL is empty in dev to use Vite proxy)
Copy-Item .env.example .env

# Run frontend unit & integration tests
npm test

# Build production bundle
npm run build

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Environment Variables

### Backend (`backend/.env`)
```ini
DEBUG=True
SECRET_KEY=django-insecure-multiwork-development-key
DB_NAME=multiwork_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=127.0.0.1
DB_PORT=5432
```

### Frontend (`frontend/.env.example`)
```ini
# Base URL for Django REST Framework API
# Leave empty in local dev to route through Vite proxy (/api -> http://127.0.0.1:8000)
VITE_API_BASE_URL=
```

---

## Role-Based Demo User Acceptance Testing

To test the end-to-end multi-service lifecycle with realistic Coimbatore data:

### Step 1: Admin Approval of Worker
1. Navigate to `http://localhost:5173/login`.
2. Sign in as Admin: `admin` / `Admin@12345`.
3. Open **Worker Verification** (`/admin/workers`).
4. Review pending service professionals, inspect their qualification certificates/experience, and click **Approve Worker**.

### Step 2: Worker Setup & Availability
1. Log out or open an incognito window.
2. Sign in as an approved Worker (e.g. `cbe_worker_plumber` or register a new worker via `/register`).
3. Toggle availability switch to **Available for Broadcasts** on `/worker/dashboard`.
4. Navigate to **My Services** (`/worker/services`) and verify active service offerings (e.g., Pipe Repair, Tap Installation).

### Step 3: Customer Booking Creation
1. Sign in as Customer (or register a new customer account via `/register`).
2. Navigate to **Services** (`/services`) and choose a service (e.g., Plumbing -> Pipe Leak Repair).
3. Click **Book Service**. Select or add a Coimbatore address (e.g., RS Puram or Gandhipuram with coordinates `11.0168, 76.9558`).
4. Enter problem description and submit.
5. The booking status immediately updates to `Finding Workers` (broadcast dispatch).

### Step 4: Worker 60-Second Offer Acceptance
1. Switch to Worker portal.
2. Open **Job Offers** (`/worker/offers`).
3. Notice the incoming broadcast offer card with the 60-second visual countdown and approximate customer area.
4. Click **Accept Job**. The atomic database lock executes. The worker wins the job!

### Step 5: Itemized Quotation & Review
1. Worker navigates to the assigned job details (`/worker/jobs/:id`). The customer's exact address and contact are now revealed.
2. Worker fills in the itemized quotation form (labor, materials, other charges) and clicks **Submit Quotation**.
3. Customer receives an in-app notification bell update and views `/customer/bookings/:id`.
4. Customer reviews itemized breakdown and server-calculated total, and clicks **Accept Quotation**.

### Step 6: Work Execution & Completion
1. In the Worker portal, the **Start Work Now** button is now unlocked (strict invariant). Worker clicks **Start Work Now** (`IN_PROGRESS`).
2. Once the physical service is done, Worker clicks **Mark Work Completed** (`COMPLETED`).
3. Both parties see the final status badge and persistent notification log.

---

## Automated Test Verification

| Suite | Scope | Target | Result |
| :--- | :--- | :--- | :--- |
| **Django Backend** | Accounts, Auth, Services, Bookings, Concurrency, Quotations, Notifications, Audit, Location Tracking | PostgreSQL 18 | **91 / 91 Passed** (Ran in 7.02s) |
| **Vitest Frontend** | Components, Auth & Tokens, Role Guards, Work-Start Invariants, Quotation Breakdown, Map & GPS Tracking | jsdom | **22 / 22 Passed** |
| **Vite Production Build** | Full application bundling and CSS extraction | Node v24 | **Build Succeeded** (0 errors, 2.15s) |

---

## Map & GPS Live Tracking Architecture

1. **Map Engine:** Leaflet + OpenStreetMap tiles with configurable endpoints and OpenStreetMap attribution.
2. **Reverse Geocoding:** OpenStreetMap Nominatim reverse geocoding with graceful fallback and Coimbatore area presets (Gandhipuram, RS Puram, Peelamedu, Saibaba Colony, Singanallur).
3. **Dispatch Freshness:** Workers with location timestamps older than 60 minutes or with `is_location_sharing_enabled=False` are automatically excluded from the 5.0 km dispatch broadcast.
4. **Rate-Limiting Throttle:** Worker GPS coordinate updates (`POST /api/workers/me/location/`) are enforced with a 5-second server-side throttle.
5. **Customer Live Tracking:** Served via `GET /api/bookings/<uuid>/tracking/` restricted to active bookings (`ASSIGNED`, `QUOTE_PENDING`, `QUOTE_ACCEPTED`, `IN_PROGRESS`). Polling stops when work completes or cancels.
6. **Privacy Safeguards:** Worker exact coordinates are concealed until winning acceptance. Worker GPS sharing can be paused at any time by the worker.

---

## Known Limitations & Production Notes

1. **Broadcast Radius:** Location matching uses the established Haversine spherical distance model with a strict 5.0 km radius threshold within Coimbatore coordinates (`10.7000 <= lat <= 11.3500`, `76.7000 <= lng <= 77.3500`).
2. **Notification Polling:** In-app notifications poll at a polite 30-second interval via `GET /api/notifications/unread-count/`, stopping automatically when inactive or logged out.
3. **Live Tracking Polling:** Live tracking updates poll at 12-second intervals while in active transit.
4. **Quotation Currency:** All amounts are formatted in Indian Rupees (₹) with server-authoritative decimal arithmetic.
