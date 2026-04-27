from django.urls import path
from . import views

urlpatterns = [
    path('', views.create_booking, name='create-booking'),
    path('my/', views.my_bookings, name='my-bookings'),
    path('<int:booking_id>/', views.booking_detail, name='booking-detail'),
    path('<int:booking_id>/accept/', views.accept_booking, name='accept-booking'),
    path('<int:booking_id>/reject/', views.reject_booking, name='reject-booking'),
    path('<int:booking_id>/status/', views.update_booking_status, name='update-booking-status'),
    path('<int:booking_id>/review/', views.booking_review, name='booking-review'),
    path('<int:booking_id>/messages/', views.booking_messages, name='booking-messages'),
    # Admin
    path('admin/dashboard/', views.admin_dashboard, name='admin-dashboard-api'),
    path('admin/users/', views.admin_users, name='admin-users'),
    path('admin/users/<int:user_id>/delete/', views.admin_delete_user, name='admin-delete-user'),
    path('admin/mechanics/', views.admin_mechanics, name='admin-mechanics'),
    path('admin/mechanics/<int:mechanic_id>/approve/', views.admin_approve_mechanic, name='admin-approve-mechanic'),
]
