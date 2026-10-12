# MultiWork — Database Design Specification

## 1. Entity-Relationship Overview

```
+-----------------------------------------------------------+
|                           User                            |
|-----------------------------------------------------------|
| id (UUID / BigInt PK)                                     |
| username, email, phone_number                             |
| role: ENUM('CUSTOMER', 'WORKER', 'ADMIN')                 |
| is_active, created_at, updated_at                         |
+---------------------+-------------------+-----------------+
                      | 1:1               | 1:N
                      v                   v
+-----------------------------+   +-----------------------------+
|        WorkerProfile        |   |           Address           |
|-----------------------------|   |-----------------------------|
| id                          |   | id                          |
| user_id (FK -> User)        |   | user_id (FK -> User)        |
| approval_status: ENUM       |   | title (Home, Office, etc.)  |
| bio, experience_years       |   | address_line1, landmark     |
| id_document, id_number      |   | city ('Coimbatore')         |
| latitude, longitude         |   | pincode                     |
| is_available: Boolean       |   | latitude, longitude (geom)  |
| service_radius_km: Decimal  |   +--------------+--------------+
+--------------+--------------+                  |
               |                                 |
               | 1:N                             | 1:N
               v                                 v
+-----------------------------+   +-----------------------------+
|        WorkerService        |   |           Booking           |
|-----------------------------|   |-----------------------------|
| id                          |   | id (UUID PK)                |
| worker_id (FK WorkerProfile)|   | customer_id (FK -> User)    |
| service_id (FK Service)     |   | worker_id (FK WorkerProfile)|
| custom_rate: Decimal(10,2)  |   | service_id (FK Service)     |
| is_active: Boolean          |   | address_id (FK Address)     |
+--------------+--------------+   | status: ENUM                |
               |                  | problem_description         |
               v                  | scheduled_for: DateTime     |
+-----------------------------+   | created_at, updated_at      |
|           Service           |   +-------+--------------+------+
|-----------------------------|           |              |
| id                          |       1:N |          1:N |
| category_id (FK Category)   |           v              v
| name, slug, description     |   +---------------+ +---------------+
| base_price: Decimal(10,2)   |   |  WorkerOffer  | |   Quotation   |
| is_active: Boolean          |   |---------------| |---------------|
+-----------------------------+   | id            | | id            |
                                  | booking_id    | | booking_id    |
                                  | worker_id     | | worker_id     |
                                  | status: ENUM  | | status: ENUM  |
                                  | sent_at       | | total_amount  |
                                  | expires_at    | | breakdown     |
                                  | responded_at  | | est_hours     |
                                  +---------------+ +---------------+
```

---

## 2. Model Schemas & Attributes

### `User`
- `id`: BigAutoField (PK)
- `email`: EmailField (unique=True, indexed)
- `phone_number`: CharField(max_length=15, unique=True, indexed)
- `role`: CharField(choices=['CUSTOMER', 'WORKER', 'ADMIN'], default='CUSTOMER', indexed)
- Standard Django password, permissions, and audit timestamps.

### `WorkerProfile`
- `user`: OneToOneField(User, on_delete=CASCADE, related_name='worker_profile')
- `approval_status`: CharField(choices=['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], default='PENDING', indexed)
- `approval_reason`: TextField(blank=True, default='')
- `business_name`: CharField(max_length=150, blank=True)
- `experience_years`: PositiveIntegerField(default=1)
- `id_document`: FileField(upload_to='worker_docs/', blank=True, null=True)
- `latitude`: DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
- `longitude`: DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
- `last_location_updated_at`: DateTimeField(default=timezone.now, db_index=True)
- `is_location_sharing_enabled`: BooleanField(default=True, db_index=True)
- `service_radius_km`: DecimalField(max_digits=4, decimal_places=1, default=5.0)
- `is_available`: BooleanField(default=True, indexed)

### `ServiceCategory` & `Service`
- `ServiceCategory`: `name`, `slug`, `icon_name`, `description`, `is_active`.
- `Service`: `category` (FK), `name`, `slug`, `description`, `base_price` (DecimalField 10,2), `is_active`.

### `WorkerService`
- `worker`: ForeignKey(WorkerProfile)
- `service`: ForeignKey(Service)
- `custom_rate`: DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
- `is_active`: BooleanField(default=True)
- UniqueConstraint: `[worker, service]`

### `Booking`
- `id`: UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
- `customer`: ForeignKey(User, on_delete=PROTECT, related_name='customer_bookings')
- `service`: ForeignKey(Service, on_delete=PROTECT, related_name='bookings')
- `address`: ForeignKey(Address, on_delete=PROTECT, null=True, blank=True, related_name='bookings')
- Immutable service location snapshot:
  - `service_address_title`: CharField(max_length=60)
  - `service_address_line`: CharField(max_length=255)
  - `service_landmark`: CharField(max_length=150, blank=True)
  - `service_city`: CharField(max_length=100, default='Coimbatore')
  - `service_pincode`: CharField(max_length=10)
  - `service_latitude`, `service_longitude`: DecimalField(max_digits=9, decimal_places=6)
- `problem_description`: TextField()
- `status`: CharField(choices=[
    `REQUESTED`, `SEARCHING`, `ASSIGNED`, `QUOTE_PENDING`,
    `QUOTE_ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED`
  ], default='REQUESTED', db_index=True)
- `assigned_worker`: ForeignKey(WorkerProfile, null=True, blank=True, on_delete=SET_NULL, related_name='assigned_bookings')
- `assigned_at`: DateTimeField(null=True, blank=True)
- `dispatch_round`: PositiveIntegerField(default=1)
- `cancellation_reason`: TextField(blank=True, default='')
- `cancelled_by`: ForeignKey(User, null=True, blank=True, on_delete=SET_NULL)
- `cancelled_at`: DateTimeField(null=True, blank=True)
- `completed_at`: DateTimeField(null=True, blank=True)
- `created_at`, `updated_at`: DateTimeField(auto_now_add=True / auto_now=True)

### `WorkerOffer`
- `id`: BigAutoField(primary_key=True)
- `booking`: ForeignKey(Booking, related_name='offers', on_delete=CASCADE)
- `worker`: ForeignKey(WorkerProfile, related_name='offers', on_delete=CASCADE)
- `dispatch_round`: PositiveIntegerField(default=1)
- `status`: CharField(choices=[`PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `MISSED`, `CANCELLED`], default='PENDING', db_index=True)
- `sent_at`: DateTimeField(auto_now_add=True)
- `expires_at`: DateTimeField(db_index=True)
- `responded_at`: DateTimeField(null=True, blank=True)
- `rejection_reason`: TextField(blank=True, default='')
- UniqueConstraint: `[booking, worker, dispatch_round]` (name: `unique_booking_worker_dispatch_round`)

### `Quotation`
- `id`: UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
- `booking`: ForeignKey(Booking, on_delete=CASCADE, related_name='quotations')
- `worker`: ForeignKey(WorkerProfile, on_delete=PROTECT, related_name='submitted_quotations')
- `revision_number`: PositiveIntegerField(default=1)
- `status`: CharField(choices=[`PENDING`, `ACCEPTED`, `DECLINED`, `SUPERSEDED`, `WITHDRAWN`], default='PENDING', db_index=True)
- `labor_charge`: DecimalField(max_digits=10, decimal_places=2, default=0.00)
- `materials_charge`: DecimalField(max_digits=10, decimal_places=2, default=0.00)
- `other_charges`: DecimalField(max_digits=10, decimal_places=2, default=0.00)
- `total_amount`: DecimalField(max_digits=10, decimal_places=2)  # Server-calculated strictly: labor + materials + other
- `work_description`: TextField()
- `notes`: TextField(blank=True, default='')
- `customer_notes`: TextField(blank=True, default='')  # populated when declined
- `responded_at`: DateTimeField(null=True, blank=True)
- `created_at`, `updated_at`: DateTimeField(auto_now_add=True / auto_now=True)
- UniqueConstraint: `[booking, revision_number]` (name: `unique_booking_quotation_revision`)

### `QuotationItem`
- `id`: BigAutoField(primary_key=True)
- `quotation`: ForeignKey(Quotation, on_delete=CASCADE, related_name='items')
- `item_type`: CharField(choices=[`LABOR`, `MATERIAL`, `OTHER`], default='LABOR')
- `description`: CharField(max_length=255)
- `quantity`: DecimalField(max_digits=8, decimal_places=2, default=1.00)
- `unit_price`: DecimalField(max_digits=10, decimal_places=2)
- `line_total`: DecimalField(max_digits=10, decimal_places=2)  # Server-calculated strictly: quantity * unit_price

### `Notification` (apps.notifications)
- `id`: UUIDField(primary_key=True, default=uuid4, editable=False)
- `recipient`: ForeignKey(User, related_name='notifications', on_delete=CASCADE)
- `notification_type`: CharField(max_length=40, choices=[NEW_OFFER, WORKER_ASSIGNED, OFFER_ACCEPTED, NO_WORKERS, BOOKING_CANCELLED, BOOKING_EXPIRED, QUOTATION_SUBMITTED, QUOTATION_REVISED, QUOTATION_ACCEPTED, QUOTATION_DECLINED, WORK_STARTED, WORK_COMPLETED], indexed)
- `title`: CharField(max_length=200)
- `message`: TextField()
- `related_booking`: ForeignKey(Booking, null=True, blank=True, on_delete=SET_NULL, related_name='notifications')
- `is_read`: BooleanField(default=False, db_index=True)
- `read_at`: DateTimeField(null=True, blank=True)
- `idempotency_key`: CharField(max_length=150, null=True, blank=True, unique=True)
- `created_at`: DateTimeField(auto_now_add=True, db_index=True)
- **Indexes**:
  - `(recipient, -created_at)`: Optimal for paginated user inbox queries
  - `(recipient, is_read)`: Backs fast `unread-count` database aggregation

### `AuditEvent` (apps.notifications)
- `id`: UUIDField(primary_key=True, default=uuid4, editable=False)
- `event_type`: CharField(max_length=50, choices=[BOOKING_CREATED, OFFERS_DISPATCHED, WORKER_ACCEPTED, WORKER_REJECTED, OFFERS_EXPIRED, BOOKING_CANCELLED, BOOKING_RETRIED, QUOTATION_SUBMITTED, QUOTATION_REVISED, QUOTATION_ACCEPTED, QUOTATION_DECLINED, WORK_STARTED, WORK_COMPLETED, WORKER_APPROVAL_UPDATED], db_index=True)
- `actor`: ForeignKey(User, null=True, blank=True, on_delete=SET_NULL, related_name='audit_events')
- `related_booking`: ForeignKey(Booking, null=True, blank=True, on_delete=SET_NULL, related_name='audit_events')
- `timestamp`: DateTimeField(auto_now_add=True, db_index=True)
- `outcome`: CharField(max_length=50, default='SUCCESS')
- `metadata`: JSONField(default=dict) — sanitized context strictly excluding passwords, JWT tokens, exact street addresses, and ID document numbers.
- **Indexes**:
  - `(event_type, -timestamp)`: For administrator filtering by event type
  - `(related_booking, -timestamp)`: For chronological booking audit history inspection

