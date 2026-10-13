from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db import connection
import logging

logger = logging.getLogger(__name__)

class HealthCheckView(APIView):
    """
    Lightweight health check endpoint for operational monitoring.
    Validates PostgreSQL database connectivity and returns system health status.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
        except Exception as e:
            logger.error(f"Health check database failure: {e}")
            return Response({
                "status": "unhealthy",
                "database": "disconnected"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            "status": "healthy",
            "service": "Home 2 Service API",
            "database": "connected"
        }, status=status.HTTP_200_OK)


class ApiRootView(APIView):
    """
    Root API directory listing operational endpoints and service metadata.
    Provides structured entry point info at '/' and '/api/'.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            "service": "Home 2 Service API",
            "status": "online",
            "version": "1.0.0",
            "endpoints": {
                "health": "/api/health/",
                "auth": "/api/auth/",
                "services": "/api/services/catalog/",
                "categories": "/api/services/categories/",
                "bookings": "/api/bookings/",
                "notifications": "/api/notifications/",
                "admin": "/admin/"
            }
        }, status=status.HTTP_200_OK)

