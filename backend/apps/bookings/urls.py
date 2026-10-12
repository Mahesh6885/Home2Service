from django.urls import path
from .views import (
    BookingListCreateView,
    BookingDetailView,
    BookingCancelView,
    BookingRetryView,
    BookingTrackingView,
    WorkerHeadingView,
    WorkerArriveView,
    WorkerDelayView,
    CustomerReportNoShowView,
    BookingReassignView,
)

urlpatterns = [
    path('', BookingListCreateView.as_view(), name='booking_list_create'),
    path('<uuid:pk>/', BookingDetailView.as_view(), name='booking_detail'),
    path('<uuid:pk>/tracking/', BookingTrackingView.as_view(), name='booking_tracking'),
    path('<uuid:pk>/cancel/', BookingCancelView.as_view(), name='booking_cancel'),
    path('<uuid:pk>/retry/', BookingRetryView.as_view(), name='booking_retry'),
    path('<uuid:pk>/worker-heading/', WorkerHeadingView.as_view(), name='booking_worker_heading'),
    path('<uuid:pk>/worker-arrive/', WorkerArriveView.as_view(), name='booking_worker_arrive'),
    path('<uuid:pk>/worker-delay/', WorkerDelayView.as_view(), name='booking_worker_delay'),
    path('<uuid:pk>/report-no-show/', CustomerReportNoShowView.as_view(), name='booking_report_no_show'),
    path('<uuid:pk>/reassign/', BookingReassignView.as_view(), name='booking_reassign'),
]
