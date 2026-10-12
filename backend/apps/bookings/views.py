from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.accounts.permissions import IsCustomer, IsApprovedWorker, IsAdminUserRole
from apps.bookings.models import (
    Booking,
    WorkerOffer,
    BookingStatus,
    OfferStatus,
    NoShowReport,
    IncidentStatus,
    WorkerTravelStatus
)
from apps.bookings.serializers import (
    BookingCreateSerializer,
    BookingDetailSerializer,
    WorkerOfferSerializer,
    WorkerDelaySerializer,
    NoShowReportSerializer,
    NoShowReportCreateSerializer,
)
from apps.bookings.services.dispatch import (
    create_booking_and_dispatch,
    accept_worker_offer,
    reject_worker_offer,
    retry_booking_dispatch,
    ConflictError,
    OfferExpiredError,
    BookingStateError,
)
from apps.bookings.services.booking_lifecycle import (
    cancel_booking_by_customer,
    worker_confirm_heading,
    worker_confirm_arrival,
    worker_report_delay,
    report_worker_no_show,
    release_assignment_and_reassign,
)


class BookingListCreateView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        bookings = Booking.objects.filter(customer=request.user).select_related(
            'service', 'service__category', 'assigned_worker', 'assigned_worker__user'
        ).order_by('-created_at')
        serializer = BookingDetailSerializer(bookings, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        service = serializer.validated_data['service']
        address = serializer.validated_data['address']
        problem_description = serializer.validated_data['problem_description']

        try:
            booking, dispatched_count = create_booking_and_dispatch(
                customer=request.user,
                service=service,
                address=address,
                problem_description=problem_description,
                search_radius_km=5.0
            )
        except (ValueError, PermissionError) as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        detail_serializer = BookingDetailSerializer(booking, context={'request': request})
        return Response({
            "message": (
                f"Booking created and broadcast to {dispatched_count} nearby eligible workers within 5 km."
                if dispatched_count > 0 else
                "Booking created, but no eligible workers are currently available within 5 km in Coimbatore."
            ),
            "dispatched_workers_count": dispatched_count,
            "booking": detail_serializer.data
        }, status=status.HTTP_201_CREATED)


class BookingDetailView(generics.RetrieveAPIView):
    permission_classes = [IsCustomer]
    serializer_class = BookingDetailSerializer

    def get_queryset(self):
        return Booking.objects.filter(customer=self.request.user).select_related(
            'service', 'service__category', 'assigned_worker', 'assigned_worker__user'
        )


class BookingCancelView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        reason = request.data.get('reason', 'Cancelled by customer')
        try:
            booking = cancel_booking_by_customer(
                booking_id=pk,
                customer=request.user,
                reason=reason
            )
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except BookingStateError as bse:
            return Response({"error": str(bse)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BookingDetailSerializer(booking, context={'request': request})
        return Response({
            "message": "Booking has been successfully cancelled.",
            "booking": serializer.data
        }, status=status.HTTP_200_OK)


class BookingRetryView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(id=pk, customer=request.user)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            booking, dispatched_count = retry_booking_dispatch(
                booking=booking,
                customer=request.user,
                search_radius_km=5.0
            )
        except (ConflictError, BookingStateError) as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BookingDetailSerializer(booking, context={'request': request})
        return Response({
            "message": f"Broadcast retry launched. Dispatched to {dispatched_count} eligible workers.",
            "dispatched_workers_count": dispatched_count,
            "booking": serializer.data
        }, status=status.HTTP_200_OK)


# -------------------------------------------------------------------------
# Worker Offers Views
# -------------------------------------------------------------------------

class WorkerOfferListView(generics.ListAPIView):
    permission_classes = [IsApprovedWorker]
    serializer_class = WorkerOfferSerializer

    def get_queryset(self):
        worker = self.request.user.worker_profile
        queryset = WorkerOffer.objects.filter(worker=worker).select_related(
            'booking', 'booking__service', 'booking__service__category'
        ).order_by('-sent_at')

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())
        return queryset


class WorkerOfferDetailView(generics.RetrieveAPIView):
    permission_classes = [IsApprovedWorker]
    serializer_class = WorkerOfferSerializer

    def get_queryset(self):
        worker = self.request.user.worker_profile
        return WorkerOffer.objects.filter(worker=worker).select_related(
            'booking', 'booking__service', 'booking__service__category'
        )


class WorkerOfferAcceptView(APIView):
    permission_classes = [IsApprovedWorker]

    def post(self, request, pk):
        worker = request.user.worker_profile
        try:
            booking = accept_worker_offer(offer_id=pk, worker_profile=worker)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except OfferExpiredError as oee:
            return Response({"error": str(oee)}, status=status.HTTP_400_BAD_REQUEST)
        except ConflictError as ce:
            return Response({"error": str(ce)}, status=status.HTTP_409_CONFLICT)
        except BookingStateError as bse:
            return Response({"error": str(bse)}, status=status.HTTP_409_CONFLICT)

        # Retrieve the winning offer to return in response
        offer = WorkerOffer.objects.get(id=pk)
        return Response({
            "message": "Congratulations! You have won and been assigned this booking.",
            "booking_id": str(booking.id),
            "offer": WorkerOfferSerializer(offer, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class WorkerOfferRejectView(APIView):
    permission_classes = [IsApprovedWorker]

    def post(self, request, pk):
        worker = request.user.worker_profile
        reason = request.data.get('reason', '')
        try:
            offer = reject_worker_offer(offer_id=pk, worker_profile=worker, reason=reason)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)

        return Response({
            "message": "Offer rejected.",
            "offer_id": offer.id,
            "status": offer.status
        }, status=status.HTTP_200_OK)


# -------------------------------------------------------------------------
# Admin Views
# -------------------------------------------------------------------------

class AdminBookingListView(generics.ListAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = BookingDetailSerializer

    def get_queryset(self):
        queryset = Booking.objects.select_related(
            'customer', 'service', 'service__category', 'assigned_worker', 'assigned_worker__user'
        ).order_by('-created_at')

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())
        return queryset


class AdminBookingDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = BookingDetailSerializer
    queryset = Booking.objects.select_related(
        'customer', 'service', 'service__category', 'assigned_worker', 'assigned_worker__user'
    )


class BookingTrackingView(APIView):
    """
    Live location tracking endpoint for an assigned booking.
    Only accessible by the booking's customer, the assigned worker, or administrators.
    Provides latest worker coordinates, destination coordinates, freshness state, and distance.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            booking = Booking.objects.select_related(
                'customer', 'assigned_worker', 'assigned_worker__user'
            ).get(id=pk)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        # Strict authorization: Only the customer, assigned worker, or admin
        is_customer = booking.customer == request.user
        is_assigned_worker = bool(booking.assigned_worker and booking.assigned_worker.user == request.user)
        is_admin = bool(request.user.role == 'ADMIN' or request.user.is_superuser or request.user.is_staff)

        if not (is_customer or is_assigned_worker or is_admin):
            return Response(
                {"detail": "You do not have permission to view tracking for this booking."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Before worker assignment
        if not booking.assigned_worker or booking.status in [BookingStatus.REQUESTED, BookingStatus.SEARCHING, BookingStatus.EXPIRED]:
            return Response({
                "tracking_available": False,
                "is_location_available": False,
                "reason": "Worker has not been assigned yet.",
                "booking_id": str(booking.id),
                "booking_status": booking.status
            }, status=status.HTTP_200_OK)

        # After work has finished (completed or cancelled)
        if booking.status in [BookingStatus.COMPLETED, BookingStatus.CANCELLED]:
            return Response({
                "tracking_available": False,
                "is_location_available": False,
                "reason": f"Tracking ended because booking is {booking.status.lower()}.",
                "booking_id": str(booking.id),
                "booking_status": booking.status
            }, status=status.HTTP_200_OK)

        worker = booking.assigned_worker

        # Check if worker has location sharing enabled
        if not worker.is_location_sharing_enabled:
            return Response({
                "tracking_available": False,
                "is_location_available": False,
                "reason": "Service professional has paused location sharing.",
                "booking_id": str(booking.id),
                "booking_status": booking.status
            }, status=status.HTTP_200_OK)

        if worker.latitude is None or worker.longitude is None:
            return Response({
                "tracking_available": False,
                "is_location_available": False,
                "reason": "Worker location coordinates are not available.",
                "booking_id": str(booking.id),
                "booking_status": booking.status
            }, status=status.HTTP_200_OK)

        # Check freshness for live tracking
        from django.conf import settings
        from django.utils import timezone
        from datetime import timedelta
        freshness_minutes = getattr(settings, 'LIVE_TRACKING_FRESHNESS_MINUTES', 15)
        cutoff = timezone.now() - timedelta(minutes=freshness_minutes)
        is_stale = not worker.last_location_updated_at or worker.last_location_updated_at < cutoff

        # Compute distance to customer destination
        distance_km = None
        from apps.bookings.services.location import haversine_distance_km
        if booking.service_latitude and booking.service_longitude:
            distance_km = round(haversine_distance_km(
                float(booking.service_latitude),
                float(booking.service_longitude),
                float(worker.latitude),
                float(worker.longitude)
            ), 2)

        worker_lat = float(worker.latitude)
        worker_lng = float(worker.longitude)
        dest_lat = float(booking.service_latitude) if booking.service_latitude else None
        dest_lng = float(booking.service_longitude) if booking.service_longitude else None

        return Response({
            "tracking_available": True,
            "is_location_available": True,
            "booking_id": str(booking.id),
            "booking_status": booking.status,
            "worker_name": worker.user.get_full_name() or worker.user.username,
            "worker_latitude": worker_lat,
            "worker_longitude": worker_lng,
            "worker_location": {
                "latitude": worker_lat,
                "longitude": worker_lng
            },
            "destination_latitude": dest_lat,
            "destination_longitude": dest_lng,
            "destination_location": {
                "latitude": dest_lat,
                "longitude": dest_lng
            } if dest_lat and dest_lng else None,
            "distance_km": distance_km,
            "last_updated_at": worker.last_location_updated_at.isoformat() if worker.last_location_updated_at else None,
            "is_stale": is_stale
        }, status=status.HTTP_200_OK)


# -------------------------------------------------------------------------
# Worker Travel & Arrival Lifecycle Actions
# -------------------------------------------------------------------------

class WorkerHeadingView(APIView):
    """
    Endpoint for assigned approved worker to confirm transit to customer destination.
    """
    permission_classes = [IsApprovedWorker]

    def post(self, request, pk):
        worker = getattr(request.user, 'worker_profile', None)
        try:
            booking = worker_confirm_heading(booking_id=pk, worker_profile=worker)
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except BookingStateError as bse:
            return Response({"error": str(bse)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "Heading to job confirmed. Customer has been notified.",
            "travel_status": booking.travel_status,
            "worker_heading_at": booking.worker_heading_at.isoformat() if booking.worker_heading_at else None
        }, status=status.HTTP_200_OK)


class WorkerArriveView(APIView):
    """
    Endpoint for assigned approved worker to confirm arrival at the service location.
    Note: Does not bypass quotation acceptance required for work start.
    """
    permission_classes = [IsApprovedWorker]

    def post(self, request, pk):
        worker = getattr(request.user, 'worker_profile', None)
        try:
            booking = worker_confirm_arrival(booking_id=pk, worker_profile=worker)
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except BookingStateError as bse:
            return Response({"error": str(bse)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "Arrival confirmed at customer address.",
            "travel_status": booking.travel_status,
            "worker_arrived_at": booking.worker_arrived_at.isoformat() if booking.worker_arrived_at else None
        }, status=status.HTTP_200_OK)


class WorkerDelayView(APIView):
    """
    Endpoint for assigned worker to report transit delay with explanation and ETA.
    """
    permission_classes = [IsApprovedWorker]

    def post(self, request, pk):
        worker = getattr(request.user, 'worker_profile', None)
        serializer = WorkerDelaySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reason = serializer.validated_data['reason']
        est_minutes = serializer.validated_data.get('estimated_minutes')

        try:
            booking = worker_report_delay(booking_id=pk, worker_profile=worker, reason=reason, estimated_minutes=est_minutes)
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except BookingStateError as bse:
            return Response({"error": str(bse)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "Delay reported. Customer has been updated.",
            "travel_status": booking.travel_status,
            "delay_reason": booking.delay_reason,
            "estimated_arrival_minutes": booking.estimated_arrival_minutes
        }, status=status.HTTP_200_OK)


# -------------------------------------------------------------------------
# Customer No-Show Incident Reporting & Reassignment
# -------------------------------------------------------------------------

class CustomerReportNoShowView(APIView):
    """
    Customer files a formal no-show report when the assigned worker does not arrive.
    """
    permission_classes = [IsCustomer]

    def post(self, request, pk):
        serializer = NoShowReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reason = serializer.validated_data['reason']
        try:
            report = report_worker_no_show(booking_id=pk, customer=request.user, reason=reason)
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except BookingStateError as bse:
            return Response({"error": str(bse)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "No-show report filed successfully. The incident is logged and under review.",
            "report": NoShowReportSerializer(report).data
        }, status=status.HTTP_201_CREATED)


class BookingReassignView(APIView):
    """
    Releases the currently assigned worker and re-dispatches to other nearby eligible workers.
    Accessible by booking customer or admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        resolution_notes = request.data.get('reason', 'Reassignment requested due to worker unresponsiveness or delay')
        try:
            booking, count = release_assignment_and_reassign(booking_id=pk, actor=request.user, resolution_notes=resolution_notes)
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except BookingStateError as bse:
            return Response({"error": str(bse)}, status=status.HTTP_400_BAD_REQUEST)

        detail_serializer = BookingDetailSerializer(booking, context={'request': request})
        return Response({
            "message": f"Previous assignment released. Broadcasted to {count} nearby service professionals.",
            "dispatched_workers_count": count,
            "booking": detail_serializer.data
        }, status=status.HTTP_200_OK)


# -------------------------------------------------------------------------
# Administrator Incident Review Endpoints
# -------------------------------------------------------------------------

class AdminNoShowIncidentListView(generics.ListAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = NoShowReportSerializer

    def get_queryset(self):
        queryset = NoShowReport.objects.select_related(
            'booking', 'reported_by', 'assigned_worker', 'assigned_worker__user', 'resolved_by'
        ).order_by('-created_at')

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.upper())
        return queryset


class AdminNoShowIncidentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = NoShowReportSerializer
    queryset = NoShowReport.objects.select_related(
        'booking', 'reported_by', 'assigned_worker', 'assigned_worker__user', 'resolved_by'
    )

