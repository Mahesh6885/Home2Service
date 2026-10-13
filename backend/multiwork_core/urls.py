from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.services.views import (
    AdminServiceCategoryListCreateView,
    AdminServiceCategoryDetailView,
    AdminServiceCatalogListCreateView,
    AdminServiceCatalogDetailView,
    WorkerOfferingListCreateView,
    WorkerOfferingDetailView,
)

from apps.bookings.views import (
    WorkerOfferListView,
    WorkerOfferDetailView,
    WorkerOfferAcceptView,
    WorkerOfferRejectView,
    AdminBookingListView,
    AdminBookingDetailView,
    AdminNoShowIncidentListView,
    AdminNoShowIncidentDetailView,
)

from apps.notifications.views import AdminAuditEventListView
from apps.accounts.views import WorkerLocationUpdateView
from multiwork_core.health import HealthCheckView, ApiRootView

urlpatterns = [
    path('', ApiRootView.as_view(), name='root_index'),
    path('api/', ApiRootView.as_view(), name='api_index'),
    path('admin/', admin.site.urls),
    path('api/health/', HealthCheckView.as_view(), name='api_health_check'),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/services/', include('apps.services.urls')),
    path('api/bookings/', include('apps.bookings.urls')),
    path('api/bookings/', include('apps.quotations.urls')),
    path('api/notifications/', include('apps.notifications.urls')),

    # Dedicated Administrator Audit Trail Endpoints
    path('api/admin/audit-events/', AdminAuditEventListView.as_view(), name='admin_audit_events_list'),

    # Dedicated Administrator Services Management Endpoints
    path('api/admin/services/categories/', AdminServiceCategoryListCreateView.as_view(), name='admin_category_list_create'),
    path('api/admin/services/categories/<int:pk>/', AdminServiceCategoryDetailView.as_view(), name='admin_category_detail'),
    path('api/admin/services/catalog/', AdminServiceCatalogListCreateView.as_view(), name='admin_catalog_list_create'),
    path('api/admin/services/catalog/<int:pk>/', AdminServiceCatalogDetailView.as_view(), name='admin_catalog_detail'),

    # Dedicated Worker Service Offerings Endpoints
    path('api/workers/me/services/', WorkerOfferingListCreateView.as_view(), name='worker_services_list_create'),
    path('api/workers/me/services/<int:pk>/', WorkerOfferingDetailView.as_view(), name='worker_services_detail'),

    # Dedicated Worker Live Location & GPS Update Endpoint
    path('api/workers/me/location/', WorkerLocationUpdateView.as_view(), name='worker_me_location'),

    # Dedicated Worker Broadcast Offers Endpoints
    path('api/workers/me/offers/', WorkerOfferListView.as_view(), name='worker_offers_list'),
    path('api/workers/me/offers/<int:pk>/', WorkerOfferDetailView.as_view(), name='worker_offers_detail'),
    path('api/workers/me/offers/<int:pk>/accept/', WorkerOfferAcceptView.as_view(), name='worker_offers_accept'),
    path('api/workers/me/offers/<int:pk>/reject/', WorkerOfferRejectView.as_view(), name='worker_offers_reject'),

    # Dedicated Administrator Bookings Endpoints
    path('api/admin/bookings/', AdminBookingListView.as_view(), name='admin_bookings_list'),
    path('api/admin/bookings/<uuid:pk>/', AdminBookingDetailView.as_view(), name='admin_bookings_detail'),

    # Dedicated Administrator Incident Management Endpoints
    path('api/admin/incidents/', AdminNoShowIncidentListView.as_view(), name='admin_incidents_list'),
    path('api/admin/incidents/<uuid:pk>/', AdminNoShowIncidentDetailView.as_view(), name='admin_incidents_detail'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
