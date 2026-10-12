# MultiWork — Requirements Specification & Traceability Matrix

**Project:** MultiWork — Location-Based Multi-Service Booking Platform  
**Target City:** Coimbatore, Tamil Nadu, India  
**Target Delivery Date:** 20 October 2026  
**Status:** MVP In Progress  

---

## 1. Scope & System Objective

MultiWork is an on-demand, location-aware multi-service booking platform specifically built for Coimbatore, Tamil Nadu. It bridges local service seekers (Customers) with qualified, verified service professionals (Workers) across trades including Plumbing, Electrical, Vehicle Mechanics, Appliance Repair, Cleaning, and Carpentry.

The platform provides:
1. Role-based accounts: Customer, Worker, Admin.
2. Geolocation & manual address matching centered in Coimbatore within an initial strict 5 km search radius.
3. Real-time broadcast dispatching with a 60-second offer timeout and first-valid-acceptance atomic assignment.
4. Itemized Quotation workflow where prices are agreed before any work begins.
5. Strict, auditable booking state machine.
6. Persistent in-app notifications and polling-based live dashboard updates.
7. Role-enforced REST APIs and responsive, accessible React frontend.

---

## 2. Functional Requirements Matrix

| Req ID | Category | Description | Verification Method |
|---|---|---|---|
| **REQ-AUTH-01** | Account | Single custom user model (`User`) with `role` (`CUSTOMER`, `WORKER`, `ADMIN`). | Unit & Model Tests |
| **REQ-AUTH-02** | Account | Worker registration with distinct `WorkerProfile` requiring Admin approval before receiving job broadcasts. | API & Integration Tests |
| **REQ-AUTH-03** | Account | Secure JWT authentication, password hashing, and role-based permissions on every DRF endpoint. | Automated API Tests |
| **REQ-AUTH-04** | Account | Admin accounts created only via secure CLI management command, never public self-registration. | CLI & Security Tests |
| **REQ-SVC-01** | Services | Service Categories and Services managed by Admin (CRUD, active/inactive flag). | API Tests |
| **REQ-SVC-02** | Services | Workers select multiple offered services with base rates and experience details. | API Tests |
| **REQ-GEO-01** | Location | Coimbatore boundary bounding box validation (Lat: 10.90 to 11.15, Lon: 76.85 to 77.10 approx) and strict 5 km radius matching. | Haversine Geo Tests |
| **REQ-GEO-02** | Location | Customer location capture via browser Geolocation API or manual address selection with Leaflet map picker. | Frontend & API Tests |
| **REQ-GEO-03** | Location | Customer exact address privacy: Only approximate location exposed during broadcast; exact address shared only with the winning worker. | Security Tests |
| **REQ-DISP-01** | Dispatch | Broadcast eligible job offers to all active, approved, available workers offering the service within 5 km. | Unit & Integration Tests |
| **REQ-DISP-02** | Dispatch | 60-second offer expiry calculated with server-side timezone-aware timestamps. | Expiration Tests |
| **REQ-DISP-03** | Dispatch | Atomic assignment: First worker to accept wins; competing offers transition to `EXPIRED` / `MISSED` immediately using DB row-locking (`select_for_update`). | Concurrency Tests |
| **REQ-DISP-04** | Dispatch | Retry mechanism if no worker accepts within the 60-second window. | State Machine Tests |
| **REQ-QUOTE-01**| Pricing | Quotation workflow: Assigned worker submits itemized quote (`amount`, `estimated_hours`, `breakdown`). | Quotation Tests |
| **REQ-QUOTE-02**| Pricing | Customer reviews quotation and can `ACCEPT` or `DECLINE`. Work cannot start before quote acceptance. | State Machine Tests |
| **REQ-QUOTE-03**| Pricing | Decimal fields used for all currency calculations; no floating point arithmetic. | Unit Tests |
| **REQ-BOOK-01** | Booking | Strict state transitions: `REQUESTED` -> `SEARCHING` -> `ASSIGNED` -> `QUOTE_PENDING` -> `QUOTED` -> `QUOTE_ACCEPTED` -> `IN_PROGRESS` -> `COMPLETED` / `CANCELLED`. | State Machine Tests |
| **REQ-BOOK-02** | Booking | Customer cancellation allowed freely before worker acceptance; post-acceptance rules configurable. | State Machine Tests |
| **REQ-NOTIF-01**| Notification | Persistent in-app notifications generated for all key lifecycle events. | Integration Tests |
| **REQ-ADMIN-01**| Admin | Dashboard with real DB metrics, worker verification queue, service management, user suspension. | Admin Tests |

---

## 3. Non-Functional Requirements

- **Security:** CSRF protection, CORS whitelist, JWT tokens, environment-driven secrets, no sensitive data leakage.
- **Reliability:** AC-ID database transactions and concurrency safety on job assignment.
- **Performance:** Sub-100ms API response time for match calculations within the 5 km bounding radius.
- **Accessibility & UX:** Mobile-first responsive UI, accessible color contrast, clear countdown timers.
- **Maintainability:** Modular monolithic architecture without premature microservice or message broker bloat.
