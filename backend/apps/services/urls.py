from django.urls import path
from .views import (
    PublicServiceCategoryListView,
    PublicServiceCategoryDetailView,
    PublicServiceCatalogListView,
    PublicServiceCatalogDetailView,
    AdminServiceCategoryListCreateView,
    AdminServiceCategoryDetailView,
    AdminServiceCatalogListCreateView,
    AdminServiceCatalogDetailView,
    WorkerOfferingListCreateView,
    WorkerOfferingDetailView,
)

urlpatterns = [
    # Public Catalog
    path('categories/', PublicServiceCategoryListView.as_view(), name='service_category_list'),
    path('categories/<int:pk>/', PublicServiceCategoryDetailView.as_view(), name='service_category_detail'),
    path('catalog/', PublicServiceCatalogListView.as_view(), name='service_catalog_list'),
    path('catalog/<int:pk>/', PublicServiceCatalogDetailView.as_view(), name='service_catalog_detail'),

    # Admin Management (under /api/services/admin/...)
    path('admin/categories/', AdminServiceCategoryListCreateView.as_view(), name='services_admin_category_list_create'),
    path('admin/categories/<int:pk>/', AdminServiceCategoryDetailView.as_view(), name='services_admin_category_detail'),
    path('admin/catalog/', AdminServiceCatalogListCreateView.as_view(), name='services_admin_catalog_list_create'),
    path('admin/catalog/<int:pk>/', AdminServiceCatalogDetailView.as_view(), name='services_admin_catalog_detail'),

    # Worker Offerings (also accessible under services namespace)
    path('worker-offerings/', WorkerOfferingListCreateView.as_view(), name='services_worker_offering_list_create'),
    path('worker-offerings/<int:pk>/', WorkerOfferingDetailView.as_view(), name='services_worker_offering_detail'),
]
