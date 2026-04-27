from django.contrib import admin
from .models import Booking, Review, Message

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'mechanic', 'vehicle_type', 'status', 'urgency', 'created_at']
    list_filter = ['status', 'vehicle_type', 'urgency']
    search_fields = ['customer__username', 'issue_description']

@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['booking', 'rating', 'created_at']

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['booking', 'sender', 'timestamp', 'is_read']
