from django.db import models
from django.conf import settings


class MechanicProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='mechanic_profile')
    skills = models.TextField(blank=True, default='', help_text='Comma-separated skills e.g. Tires, Engine, AC')
    experience_years = models.PositiveIntegerField(default=0)
    service_radius_km = models.FloatField(default=15.0)
    is_available = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=False)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    bio = models.TextField(blank=True)
    id_proof = models.ImageField(upload_to='mechanic_docs/', blank=True, null=True)
    total_jobs = models.PositiveIntegerField(default=0)
    total_earnings = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Mechanic"

    class Meta:
        db_table = 'mechanic_profiles'
