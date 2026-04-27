from django.db import models
from django.conf import settings


class Booking(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_EN_ROUTE = 'en_route'
    STATUS_ARRIVED = 'arrived'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_EN_ROUTE, 'En Route'),
        (STATUS_ARRIVED, 'Arrived'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    VEHICLE_CHOICES = [
        ('car', 'Car'),
        ('bike', 'Bike/Motorcycle'),
        ('truck', 'Truck'),
        ('auto', 'Auto Rickshaw'),
        ('other', 'Other'),
    ]

    URGENCY_CHOICES = [
        ('low', 'Low - Can wait'),
        ('medium', 'Medium - Within an hour'),
        ('high', 'High - Urgent'),
        ('emergency', 'Emergency - Stranded'),
    ]

    SERVICE_MECHANIC = 'mechanic'
    SERVICE_TOW = 'tow'
    SERVICE_CHOICES = [
        (SERVICE_MECHANIC, 'Mechanic'),
        (SERVICE_TOW, 'Tow Service'),
    ]

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='customer_bookings'
    )
    mechanic = models.ForeignKey(
        'mechanics.MechanicProfile', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='mechanic_bookings'
    )
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_CHOICES)
    issue_description = models.TextField()
    urgency = models.CharField(max_length=20, choices=URGENCY_CHOICES, default='medium')
    service_type = models.CharField(max_length=20, choices=SERVICE_CHOICES, default=SERVICE_MECHANIC)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    customer_lat = models.FloatField()
    customer_lng = models.FloatField()
    customer_address = models.TextField(blank=True)
    distance_km = models.FloatField(null=True, blank=True)
    service_charge = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Booking #{self.id} - {self.customer.username} ({self.status})"

    class Meta:
        db_table = 'bookings'
        ordering = ['-created_at']


class Review(models.Model):
    booking = models.OneToOneField(Booking, on_delete=models.CASCADE, related_name='review')
    rating = models.PositiveSmallIntegerField(choices=[(i, i) for i in range(1, 6)])
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review for Booking #{self.booking.id} - {self.rating} stars"

    class Meta:
        db_table = 'reviews'


class Message(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Message in Booking #{self.booking.id} from {self.sender.username}"

    class Meta:
        db_table = 'messages'
        ordering = ['timestamp']
