from rest_framework import permissions
from .models import UserRole, WorkerApprovalStatus

class IsCustomer(permissions.BasePermission):
    """Allows access only to authenticated customers."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == UserRole.CUSTOMER
        )


class IsWorker(permissions.BasePermission):
    """Allows access only to authenticated workers."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == UserRole.WORKER
        )


class IsApprovedWorker(permissions.BasePermission):
    """Allows access only to workers verified and approved by an administrator."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.role == UserRole.WORKER):
            return False
        
        profile = getattr(request.user, 'worker_profile', None)
        return bool(
            profile and
            profile.approval_status == WorkerApprovalStatus.APPROVED and
            profile.is_active
        )


class IsAdminUserRole(permissions.BasePermission):
    """Allows access to administrators only."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == UserRole.ADMIN or request.user.is_superuser or request.user.is_staff)
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """Object level permission allowing the owner of the object or an admin."""
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role == UserRole.ADMIN or request.user.is_superuser:
            return True
        
        # Check standard user association
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'customer'):
            return obj.customer == request.user
        return obj == request.user
