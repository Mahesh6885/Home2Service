from django.urls import path
from .views import (
    BookingQuotationListCreateView,
    BookingQuotationDetailView,
    BookingQuotationAcceptView,
    BookingQuotationDeclineView,
    BookingStartWorkView,
    BookingCompleteWorkView,
)

urlpatterns = [
    path('<uuid:booking_id>/quotations/', BookingQuotationListCreateView.as_view(), name='booking_quotations_list_create'),
    path('<uuid:booking_id>/quotations/<uuid:pk>/', BookingQuotationDetailView.as_view(), name='booking_quotation_detail'),
    path('<uuid:booking_id>/quotations/<uuid:pk>/accept/', BookingQuotationAcceptView.as_view(), name='booking_quotation_accept'),
    path('<uuid:booking_id>/quotations/<uuid:pk>/decline/', BookingQuotationDeclineView.as_view(), name='booking_quotation_decline'),
    path('<uuid:booking_id>/start-work/', BookingStartWorkView.as_view(), name='booking_start_work'),
    path('<uuid:booking_id>/complete-work/', BookingCompleteWorkView.as_view(), name='booking_complete_work'),
]
