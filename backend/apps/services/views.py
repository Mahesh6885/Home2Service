from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q

from .models import ServiceCategory, Service, WorkerService
from .serializers import (
    ServiceCategorySerializer,
    ServiceSerializer,
    WorkerServiceSerializer,
)
from apps.accounts.permissions import (
    IsAdminUserRole,
    IsWorker,
    IsApprovedWorker,
)


class IsWorkerOfferingOwner(permissions.BasePermission):
    """Ensures a worker can only inspect or modify their own service offerings."""
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'ADMIN' or request.user.is_superuser:
            return True
        worker_profile = getattr(request.user, 'worker_profile', None)
        return bool(worker_profile and obj.worker == worker_profile)


# -------------------------------------------------------------------------
# Public Catalog Views (AllowAny, Active-only records)
# -------------------------------------------------------------------------

class PublicServiceCategoryListView(generics.ListAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True).order_by('name')


class PublicServiceCategoryDetailView(generics.RetrieveAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return ServiceCategory.objects.filter(is_active=True)


class PublicServiceCatalogListView(generics.ListAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Service.objects.filter(
            is_active=True,
            category__is_active=True
        ).select_related('category').order_by('category__name', 'name')

        category_param = self.request.query_params.get('category')
        if category_param:
            if category_param.isdigit():
                queryset = queryset.filter(category_id=category_param)
            else:
                queryset = queryset.filter(category__slug=category_param)

        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(category__name__icontains=search_query)
            )

        return queryset


class PublicServiceCatalogDetailView(generics.RetrieveAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Service.objects.filter(
            is_active=True,
            category__is_active=True
        ).select_related('category')


# -------------------------------------------------------------------------
# Administrator Management Views (Admin-only, Full visibility)
# -------------------------------------------------------------------------

class AdminServiceCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        return ServiceCategory.objects.all().order_by('name')


class AdminServiceCategoryDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ServiceCategorySerializer
    permission_classes = [IsAdminUserRole]
    queryset = ServiceCategory.objects.all()


class AdminServiceCatalogListCreateView(generics.ListCreateAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        return Service.objects.select_related('category').all().order_by('category__name', 'name')


class AdminServiceCatalogDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ServiceSerializer
    permission_classes = [IsAdminUserRole]
    queryset = Service.objects.select_related('category').all()


# -------------------------------------------------------------------------
# Worker Offering Views (Only approved workers for self-management)
# -------------------------------------------------------------------------

class WorkerOfferingListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkerServiceSerializer
    permission_classes = [IsApprovedWorker]

    def get_queryset(self):
        worker = getattr(self.request.user, 'worker_profile', None)
        if not worker:
            return WorkerService.objects.none()
        return WorkerService.objects.filter(worker=worker).select_related('service', 'service__category')

    def perform_create(self, serializer):
        serializer.save(worker=self.request.user.worker_profile)


class WorkerOfferingDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WorkerServiceSerializer
    permission_classes = [IsApprovedWorker, IsWorkerOfferingOwner]

    def get_queryset(self):
        worker = getattr(self.request.user, 'worker_profile', None)
        if not worker:
            return WorkerService.objects.none()
        # Admin can view all; worker can only view own
        if self.request.user.role == 'ADMIN' or self.request.user.is_superuser:
            return WorkerService.objects.select_related('service', 'service__category').all()
        return WorkerService.objects.filter(worker=worker).select_related('service', 'service__category')

    def delete(self, request, *args, **kwargs):
        """Remove service offering from worker profile."""
        instance = self.get_object()
        service_name = instance.service.name
        instance.delete()
        return Response({
            "message": f"Service offering '{service_name}' removed successfully."
        }, status=status.HTTP_200_OK)
