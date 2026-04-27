from rest_framework import serializers
from .models import MechanicProfile
from users.serializers import UserProfileSerializer


class MechanicProfileSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = MechanicProfile
        fields = [
            'id', 'user', 'skills', 'experience_years', 'service_radius_km',
            'is_available', 'is_approved', 'lat', 'lng', 'bio',
            'total_jobs', 'total_earnings', 'distance_km', 'created_at'
        ]
        read_only_fields = ['id', 'user', 'total_jobs', 'total_earnings', 'is_approved', 'created_at']

    def get_distance_km(self, obj):
        return getattr(obj, '_distance_km', None)


class MechanicProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MechanicProfile
        fields = ['skills', 'experience_years', 'service_radius_km', 'bio', 'lat', 'lng', 'id_proof']
