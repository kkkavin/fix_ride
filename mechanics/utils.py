import math


def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate great-circle distance between two points (Haversine formula).
    Returns distance in kilometers.
    """
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def find_nearest_mechanic(customer_lat, customer_lng, radius_km=20, exclude_id=None):
    return find_nearest_provider(customer_lat, customer_lng, role='mechanic', radius_km=radius_km, exclude_id=exclude_id)


def find_nearest_tow(customer_lat, customer_lng, radius_km=20, exclude_id=None):
    return find_nearest_provider(customer_lat, customer_lng, role='tow', radius_km=radius_km, exclude_id=exclude_id)


def find_nearest_provider(customer_lat, customer_lng, role='mechanic', radius_km=20, exclude_id=None):
    from mechanics.models import MechanicProfile
    qs = MechanicProfile.objects.filter(
        user__role=role,
        is_available=True,
        lat__isnull=False,
        lng__isnull=False
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    # Mechanics additionally need admin approval
    if role == 'mechanic':
        qs = qs.filter(is_approved=True)

    nearest = None
    min_dist = float('inf')
    for profile in qs:
        dist = haversine(customer_lat, customer_lng, profile.lat, profile.lng)
        if dist <= radius_km and dist < min_dist:
            nearest = profile
            min_dist = dist
    return (nearest, round(min_dist, 2)) if nearest else (None, None)


def get_mechanics_within_radius(customer_lat, customer_lng, radius_km=20, role='mechanic'):
    """
    Return list of (MechanicProfile, distance_km) sorted by distance.
    Filters by role so both mechanics and tow operators can be queried.
    """
    from mechanics.models import MechanicProfile
    qs = MechanicProfile.objects.filter(
        user__role=role,
        is_available=True,
        lat__isnull=False,
        lng__isnull=False
    )
    if role == 'mechanic':
        qs = qs.filter(is_approved=True)

    results = []
    for profile in qs:
        dist = haversine(customer_lat, customer_lng, profile.lat, profile.lng)
        if dist <= radius_km:
            results.append((profile, round(dist, 2)))
    results.sort(key=lambda x: x[1])
    return results
