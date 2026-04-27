from rest_framework import serializers
from .models import Booking, Review, Message
from users.serializers import UserProfileSerializer
from mechanics.serializers import MechanicProfileSerializer


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ['vehicle_type', 'issue_description', 'urgency', 'customer_lat', 'customer_lng', 'customer_address', 'service_type']


class BookingSerializer(serializers.ModelSerializer):
    customer = UserProfileSerializer(read_only=True)
    mechanic = MechanicProfileSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    # Live provider location (pulled from MechanicProfile)
    mechanic_lat = serializers.SerializerMethodField()
    mechanic_lng = serializers.SerializerMethodField()

    def get_mechanic_lat(self, obj):
        return obj.mechanic.lat if obj.mechanic else None

    def get_mechanic_lng(self, obj):
        return obj.mechanic.lng if obj.mechanic else None

    class Meta:
        model = Booking
        fields = '__all__'


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ['id', 'booking', 'rating', 'comment', 'created_at']
        read_only_fields = ['id', 'created_at']


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'booking', 'sender', 'sender_username', 'sender_role', 'content', 'timestamp', 'is_read']
        read_only_fields = ['id', 'sender', 'timestamp']
