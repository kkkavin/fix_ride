from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import MechanicProfile
from .serializers import MechanicProfileSerializer, MechanicProfileUpdateSerializer
from .utils import get_mechanics_within_radius, haversine


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def mechanic_profile(request):
    try:
        profile = MechanicProfile.objects.get(user=request.user)
    except MechanicProfile.DoesNotExist:
        if request.method == 'GET':
            return Response({'error': 'Profile not found. Please create one.'}, status=404)
        # Auto-create on first PUT
        profile = MechanicProfile(user=request.user)

    if request.method == 'GET':
        serializer = MechanicProfileSerializer(profile)
        return Response(serializer.data)
    elif request.method == 'PUT':
        serializer = MechanicProfileUpdateSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(MechanicProfileSerializer(profile).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def toggle_availability(request):
    if not (request.user.is_mechanic() or request.user.is_tow()):
        return Response({'error': 'Only mechanics and tow operators can toggle availability.'}, status=403)
    try:
        profile = MechanicProfile.objects.get(user=request.user)
    except MechanicProfile.DoesNotExist:
        # Auto-create for tow operators
        profile = MechanicProfile.objects.create(user=request.user)

    lat = request.data.get('lat')
    lng = request.data.get('lng')
    if lat:
        profile.lat = float(lat)
    if lng:
        profile.lng = float(lng)

    # If it's just a location ping, don't toggle online/offline
    update_location_only = request.data.get('update_location_only', False)
    if not update_location_only:
        profile.is_available = not profile.is_available

    profile.save()
    return Response({
        'is_available': profile.is_available,
        'message': 'Location updated' if update_location_only else ('You are now Online' if profile.is_available else 'You are now Offline')
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def nearby_mechanics(request):
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    radius = float(request.query_params.get('radius', 20))
    role = request.query_params.get('role', 'mechanic')  # 'mechanic' or 'tow'

    if not lat or not lng:
        return Response({'error': 'lat and lng are required.'}, status=400)

    results = get_mechanics_within_radius(float(lat), float(lng), radius, role=role)

    mechanics_data = []
    for profile, dist in results:
        profile._distance_km = dist
        mechanics_data.append(MechanicProfileSerializer(profile).data)

    return Response({
        'count': len(mechanics_data),
        'radius_km': radius,
        'role': role,
        'mechanics': mechanics_data
    })
