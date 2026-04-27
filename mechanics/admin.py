from django.contrib import admin
from .models import MechanicProfile

@admin.register(MechanicProfile)
class MechanicProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'skills', 'experience_years', 'is_available', 'is_approved', 'total_jobs']
    list_filter = ['is_available', 'is_approved']
    list_editable = ['is_approved']
    search_fields = ['user__username', 'skills']
