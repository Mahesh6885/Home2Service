from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.accounts.permissions import IsCustomer, IsApprovedWorker
from apps.bookings.models import Booking
from apps.quotations.models import Quotation
from apps.quotations.serializers import (
    QuotationCreateSerializer,
    QuotationDetailSerializer,
    QuotationDeclineSerializer
)
from apps.quotations.services.quotation_service import (
    create_or_revise_quotation,
    accept_quotation,
    decline_quotation,
    start_work_on_booking,
    complete_work_on_booking,
    QuotationConflictError,
    QuotationStateError
)


class BookingQuotationListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id):
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        # Check access permission: customer owner, assigned worker, or admin
        is_owner_cust = (booking.customer == request.user)
        is_assigned_wkr = bool(booking.assigned_worker and booking.assigned_worker.user == request.user)
        is_admin = (request.user.role == 'ADMIN' or request.user.is_superuser)

        if not (is_owner_cust or is_assigned_wkr or is_admin):
            return Response({"error": "You do not have permission to view quotations for this booking."}, status=status.HTTP_403_FORBIDDEN)

        quotations = Quotation.objects.filter(booking=booking).select_related('worker', 'worker__user').prefetch_related('items').order_by('-revision_number')
        serializer = QuotationDetailSerializer(quotations, many=True)
        return Response(serializer.data)

    def post(self, request, booking_id):
        # Only assigned approved workers can submit quotations
        if not (request.user.role == 'WORKER' and hasattr(request.user, 'worker_profile')):
            return Response({"error": "Only registered service professionals can submit quotations."}, status=status.HTTP_403_FORBIDDEN)

        worker = request.user.worker_profile
        try:
            booking = Booking.objects.get(id=booking_id)
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        if booking.assigned_worker != worker:
            return Response({"error": "Only the worker assigned to this booking can submit a quotation."}, status=status.HTTP_403_FORBIDDEN)

        serializer = QuotationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            quotation = create_or_revise_quotation(
                booking=booking,
                worker=worker,
                work_description=data['work_description'],
                items_data=data.get('items'),
                labor_charge=data.get('labor_charge'),
                materials_charge=data.get('materials_charge'),
                other_charges=data.get('other_charges'),
                notes=data.get('notes', '')
            )
        except (ValueError, PermissionError) as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except QuotationConflictError as ce:
            return Response({"error": str(ce)}, status=status.HTTP_409_CONFLICT)
        except QuotationStateError as se:
            return Response({"error": str(se)}, status=status.HTTP_409_CONFLICT)

        return Response({
            "message": f"Quotation (Rev {quotation.revision_number}) submitted successfully and is now pending customer review.",
            "quotation": QuotationDetailSerializer(quotation).data
        }, status=status.HTTP_201_CREATED)


class BookingQuotationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id, pk):
        try:
            booking = Booking.objects.get(id=booking_id)
            quotation = Quotation.objects.select_related('worker', 'worker__user').prefetch_related('items').get(id=pk, booking=booking)
        except (Booking.DoesNotExist, Quotation.DoesNotExist):
            return Response({"error": "Quotation not found."}, status=status.HTTP_404_NOT_FOUND)

        is_owner_cust = (booking.customer == request.user)
        is_assigned_wkr = bool(booking.assigned_worker and booking.assigned_worker.user == request.user)
        is_admin = (request.user.role == 'ADMIN' or request.user.is_superuser)

        if not (is_owner_cust or is_assigned_wkr or is_admin):
            return Response({"error": "You do not have permission to view this quotation."}, status=status.HTTP_403_FORBIDDEN)

        return Response(QuotationDetailSerializer(quotation).data)


class BookingQuotationAcceptView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, booking_id, pk):
        try:
            quotation = accept_quotation(
                booking_id=booking_id,
                quotation_id=pk,
                customer=request.user
            )
        except KeyError:
            return Response({"error": "Booking or quotation not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except QuotationConflictError as ce:
            return Response({"error": str(ce)}, status=status.HTTP_409_CONFLICT)
        except QuotationStateError as se:
            return Response({"error": str(se)}, status=status.HTTP_409_CONFLICT)

        return Response({
            "message": "Quotation accepted successfully. The service professional is authorized to begin work.",
            "quotation": QuotationDetailSerializer(quotation).data
        }, status=status.HTTP_200_OK)


class BookingQuotationDeclineView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, booking_id, pk):
        serializer = QuotationDeclineSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        reason = serializer.validated_data.get('reason', '')
        try:
            quotation = decline_quotation(
                booking_id=booking_id,
                quotation_id=pk,
                customer=request.user,
                reason=reason
            )
        except KeyError:
            return Response({"error": "Booking or quotation not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except QuotationConflictError as ce:
            return Response({"error": str(ce)}, status=status.HTTP_409_CONFLICT)

        return Response({
            "message": "Quotation declined. The assigned worker may review your response and provide a revised quotation.",
            "quotation": QuotationDetailSerializer(quotation).data
        }, status=status.HTTP_200_OK)


class BookingStartWorkView(APIView):
    """
    Enforces the work-start invariant:
    Work can only begin if the customer has accepted the current quotation.
    """
    permission_classes = [IsApprovedWorker]

    def post(self, request, booking_id):
        worker = request.user.worker_profile
        try:
            booking = start_work_on_booking(booking_id=booking_id, worker=worker)
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except QuotationStateError as se:
            return Response({"error": str(se)}, status=status.HTTP_409_CONFLICT)

        return Response({
            "message": "Work has successfully begun. Booking transitioned to IN_PROGRESS.",
            "booking_id": str(booking.id),
            "status": booking.status
        }, status=status.HTTP_200_OK)


class BookingCompleteWorkView(APIView):
    """
    Marks an IN_PROGRESS booking as COMPLETED once the worker finishes work.
    """
    permission_classes = [IsApprovedWorker]

    def post(self, request, booking_id):
        worker = request.user.worker_profile
        try:
            booking = complete_work_on_booking(booking_id=booking_id, worker=worker)
        except KeyError:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError as pe:
            return Response({"error": str(pe)}, status=status.HTTP_403_FORBIDDEN)
        except QuotationStateError as se:
            return Response({"error": str(se)}, status=status.HTTP_409_CONFLICT)

        return Response({
            "message": "Work has been marked as completed. Booking transitioned to COMPLETED.",
            "booking_id": str(booking.id),
            "status": booking.status
        }, status=status.HTTP_200_OK)
