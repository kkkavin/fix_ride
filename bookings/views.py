from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Booking, Review, Message
from .serializers import BookingCreateSerializer, BookingSerializer, ReviewSerializer, MessageSerializer
from mechanics.utils import find_nearest_mechanic, find_nearest_tow, find_nearest_provider, haversine


def is_admin(user):
    return user.role == 'admin' or user.is_staff


# ─── BOOKING CRUD ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_booking(request):
    """Customer creates a booking; system auto-assigns nearest mechanic OR tow driver."""
    if not request.user.is_customer():
        return Response({'error': 'Only customers can create bookings.'}, status=403)

    serializer = BookingCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    data = serializer.validated_data
    lat = data['customer_lat']
    lng = data['customer_lng']
    service_type = data.get('service_type', 'mechanic')

    # Route to the correct provider pool based on service_type
    if service_type == 'tow':
        provider, dist = find_nearest_tow(lat, lng)
        provider_label = 'Tow driver'
    else:
        provider, dist = find_nearest_mechanic(lat, lng)
        provider_label = 'Mechanic'

    booking = Booking.objects.create(
        customer=request.user,
        mechanic=provider,
        distance_km=dist,
        **data
    )

    if provider:
        name = provider.user.get_full_name() or provider.user.username
        message = f'{provider_label} {name} assigned ({dist} km away).'
    else:
        message = f'No {provider_label.lower()}s available nearby. Your request is queued.'

    return Response({
        'message': message,
        'booking': BookingSerializer(booking).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_bookings(request):
    """Return all bookings for the authenticated user (customer, mechanic, or tow)."""
    user = request.user
    if user.is_customer():
        bookings = Booking.objects.filter(customer=user)
    elif user.is_mechanic() or user.is_tow():
        try:
            from mechanics.models import MechanicProfile
            profile = MechanicProfile.objects.get(user=user)
            bookings = Booking.objects.filter(mechanic=profile)
        except MechanicProfile.DoesNotExist:
            bookings = Booking.objects.none()
    elif is_admin(user):
        bookings = Booking.objects.all()
    else:
        bookings = Booking.objects.none()

    serializer = BookingSerializer(bookings, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def booking_detail(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found.'}, status=404)

    user = request.user
    # Check access
    if not (user == booking.customer or
            (hasattr(user, 'mechanic_profile') and user.mechanic_profile == booking.mechanic) or
            is_admin(user)):
        return Response({'error': 'Access denied.'}, status=403)

    return Response(BookingSerializer(booking).data)


# ─── BOOKING ACTIONS ─────────────────────────────────────────────────────────

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def accept_booking(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found.'}, status=404)

    user = request.user
    # Allow either the assigned mechanic or assigned tow operator to accept
    if not (hasattr(user, 'mechanic_profile') and user.mechanic_profile == booking.mechanic):
        return Response({'error': 'Only the assigned provider can accept.'}, status=403)

    if booking.status != Booking.STATUS_PENDING:
        return Response({'error': f'Cannot accept booking in status: {booking.status}'}, status=400)

    booking.status = Booking.STATUS_ACCEPTED
    booking.accepted_at = timezone.now()
    booking.save()
    return Response({'message': 'Booking accepted!', 'booking': BookingSerializer(booking).data})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def reject_booking(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found.'}, status=404)

    user = request.user
    if not (hasattr(user, 'mechanic_profile') and user.mechanic_profile == booking.mechanic):
        return Response({'error': 'Only the assigned provider can reject.'}, status=403)

    # Re-assign to next nearest provider of the SAME type
    service_type = booking.service_type
    current_mech_id = booking.mechanic.id if booking.mechanic else None
    next_provider, dist = find_nearest_provider(
        booking.customer_lat, 
        booking.customer_lng, 
        role=service_type, 
        exclude_id=current_mech_id
    )

    booking.status = Booking.STATUS_REJECTED
    booking.mechanic = None
    booking.save()

    if next_provider:
        booking.mechanic = next_provider
        booking.distance_km = dist
        booking.status = Booking.STATUS_PENDING
        booking.save()
        return Response({'message': 'Booking re-assigned to next available provider.', 'booking': BookingSerializer(booking).data})

    return Response({'message': 'Booking rejected. No other providers available.', 'booking': BookingSerializer(booking).data})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_booking_status(request, booking_id):
    """Mechanic updates job status (en_route → arrived → completed)."""
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found.'}, status=404)

    new_status = request.data.get('status')
    allowed_statuses = [Booking.STATUS_EN_ROUTE, Booking.STATUS_ARRIVED, Booking.STATUS_IN_PROGRESS,
                        Booking.STATUS_COMPLETED, Booking.STATUS_CANCELLED]

    if new_status not in allowed_statuses:
        return Response({'error': f'Invalid status. Allowed: {allowed_statuses}'}, status=400)

    user = request.user
    # Only mechanic or admin can update status
    is_mechanic = hasattr(user, 'mechanic_profile') and user.mechanic_profile == booking.mechanic
    if not (is_mechanic or is_admin(user) or (new_status == Booking.STATUS_CANCELLED and user == booking.customer)):
        return Response({'error': 'Permission denied.'}, status=403)

    booking.status = new_status
    if new_status == Booking.STATUS_COMPLETED:
        booking.completed_at = timezone.now()
        # Update mechanic stats
        if booking.mechanic:
            booking.mechanic.total_jobs += 1
            booking.mechanic.total_earnings += booking.service_charge or 500  # default ₹500
            booking.mechanic.save()
    booking.save()
    return Response({'message': f'Status updated to {new_status}', 'booking': BookingSerializer(booking).data})


# ─── REVIEWS ─────────────────────────────────────────────────────────────────

@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def booking_review(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found.'}, status=404)

    if request.method == 'GET':
        try:
            review = Review.objects.get(booking=booking)
            return Response(ReviewSerializer(review).data)
        except Review.DoesNotExist:
            return Response({'error': 'No review yet.'}, status=404)

    # POST
    if request.user != booking.customer:
        return Response({'error': 'Only the customer can review.'}, status=403)
    if booking.status != Booking.STATUS_COMPLETED:
        return Response({'error': 'Can only review completed bookings.'}, status=400)
    if Review.objects.filter(booking=booking).exists():
        return Response({'error': 'Already reviewed.'}, status=400)

    serializer = ReviewSerializer(data={'booking': booking.id, **request.data})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


# ─── CHAT MESSAGES ───────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def booking_messages(request, booking_id):
    try:
        booking = Booking.objects.get(id=booking_id)
    except Booking.DoesNotExist:
        return Response({'error': 'Booking not found.'}, status=404)

    user = request.user
    is_mechanic = hasattr(user, 'mechanic_profile') and user.mechanic_profile == booking.mechanic
    if not (user == booking.customer or is_mechanic or is_admin(user)):
        return Response({'error': 'Access denied.'}, status=403)

    if request.method == 'GET':
        messages = booking.messages.all()
        # Mark messages as read
        booking.messages.exclude(sender=user).update(is_read=True)
        return Response(MessageSerializer(messages, many=True).data)

    # POST
    content = request.data.get('content', '').strip()
    if not content:
        return Response({'error': 'Message cannot be empty.'}, status=400)

    message = Message.objects.create(booking=booking, sender=user, content=content)
    return Response(MessageSerializer(message).data, status=201)


# ─── ADMIN APIs ───────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if not is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)

    from django.contrib.auth import get_user_model
    from mechanics.models import MechanicProfile
    from django.db.models import Sum, Count

    User = get_user_model()
    total_users = User.objects.filter(is_superuser=False, is_staff=False).count()
    total_customers = User.objects.filter(role='customer').count()
    total_mechanics = User.objects.filter(role='mechanic').count()
    total_bookings = Booking.objects.count()
    active_bookings = Booking.objects.filter(status__in=['pending', 'accepted', 'en_route', 'arrived', 'in_progress']).count()
    completed_bookings = Booking.objects.filter(status='completed').count()
    cancelled_bookings = Booking.objects.filter(status__in=['cancelled', 'rejected']).count()
    pending_approval = MechanicProfile.objects.filter(is_approved=False).count()

    revenue = MechanicProfile.objects.aggregate(total=Sum('total_earnings'))['total'] or 0

    # Recent bookings
    recent = Booking.objects.select_related('customer', 'mechanic__user').order_by('-created_at')[:10]

    return Response({
        'stats': {
            'total_users': total_users,
            'total_customers': total_customers,
            'total_mechanics': total_mechanics,
            'total_bookings': total_bookings,
            'active_bookings': active_bookings,
            'completed_bookings': completed_bookings,
            'cancelled_bookings': cancelled_bookings,
            'pending_mechanic_approval': pending_approval,
            'total_revenue': float(revenue),
        },
        'recent_bookings': BookingSerializer(recent, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_users(request):
    if not is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    from django.contrib.auth import get_user_model
    from users.serializers import UserProfileSerializer
    User = get_user_model()
    users = User.objects.filter(is_superuser=False, is_staff=False).order_by('-date_joined')
    from users.serializers import UserProfileSerializer
    return Response(UserProfileSerializer(users, many=True).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_user(request, user_id):
    if not is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(id=user_id)
        if user.is_superuser or user.is_staff:
            return Response({'error': 'Cannot delete an administrator.'}, status=400)
        user.delete()
        return Response({'message': 'User deleted.'})
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_approve_mechanic(request, mechanic_id):
    if not is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    from mechanics.models import MechanicProfile
    from mechanics.serializers import MechanicProfileSerializer
    try:
        profile = MechanicProfile.objects.get(id=mechanic_id)
        action = request.data.get('action', 'approve')
        profile.is_approved = (action == 'approve')
        profile.save()
        msg = 'Mechanic access granted.' if profile.is_approved else 'Mechanic access revoked.'
        return Response({'message': msg, 'profile': MechanicProfileSerializer(profile).data})
    except MechanicProfile.DoesNotExist:
        return Response({'error': 'Mechanic profile not found.'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_mechanics(request):
    if not is_admin(request.user):
        return Response({'error': 'Admin access required.'}, status=403)
    from mechanics.models import MechanicProfile
    from mechanics.serializers import MechanicProfileSerializer
    profiles = MechanicProfile.objects.select_related('user').all()
    return Response(MechanicProfileSerializer(profiles, many=True).data)
