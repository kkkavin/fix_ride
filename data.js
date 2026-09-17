// In-memory data store for Fix Ride
export function haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // km
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let nextUserId = 14;
let nextProfileId = 8;
let nextBookingId = 5;
let nextMessageId = 6;
let nextReviewId = 3;

export const users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@fixride.com',
    first_name: 'Admin',
    last_name: 'User',
    phone: '9999999999',
    role: 'admin',
    password: 'password123',
    is_staff: true,
    is_superuser: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 2,
    username: 'rahul',
    email: 'rahul@example.com',
    first_name: 'Rahul',
    last_name: 'Sharma',
    phone: '9876543210',
    role: 'customer',
    password: 'password123',
    created_at: new Date(Date.now() - 25 * 86400000).toISOString()
  },
  {
    id: 3,
    username: 'priya',
    email: 'priya@example.com',
    first_name: 'Priya',
    last_name: 'Singh',
    phone: '9876543211',
    role: 'customer',
    password: 'password123',
    created_at: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    id: 4,
    username: 'amit',
    email: 'amit@example.com',
    first_name: 'Amit',
    last_name: 'Patel',
    phone: '9876543212',
    role: 'customer',
    password: 'password123',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    id: 5,
    username: 'neha',
    email: 'neha@example.com',
    first_name: 'Neha',
    last_name: 'Gupta',
    phone: '9876543213',
    role: 'customer',
    password: 'password123',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString()
  },
  {
    id: 6,
    username: 'rohit',
    email: 'rohit@example.com',
    first_name: 'Rohit',
    last_name: 'Kumar',
    phone: '9876543214',
    role: 'customer',
    password: 'password123',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  },
  {
    id: 7,
    username: 'mech_raj',
    email: 'raj@example.com',
    first_name: 'Rajesh',
    last_name: 'Mechanic',
    phone: '9998887771',
    role: 'mechanic',
    password: 'password123',
    created_at: new Date(Date.now() - 28 * 86400000).toISOString()
  },
  {
    id: 8,
    username: 'mech_suresh',
    email: 'suresh@example.com',
    first_name: 'Suresh',
    last_name: 'Auto',
    phone: '9998887772',
    role: 'mechanic',
    password: 'password123',
    created_at: new Date(Date.now() - 24 * 86400000).toISOString()
  },
  {
    id: 9,
    username: 'mech_arun',
    email: 'arun@example.com',
    first_name: 'Arun',
    last_name: 'Motors',
    phone: '9998887773',
    role: 'mechanic',
    password: 'password123',
    created_at: new Date(Date.now() - 18 * 86400000).toISOString()
  },
  {
    id: 10,
    username: 'mech_vijay',
    email: 'vijay@example.com',
    first_name: 'Vijay',
    last_name: 'Garage',
    phone: '9998887774',
    role: 'mechanic',
    password: 'password123',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString()
  },
  {
    id: 11,
    username: 'mech_new',
    email: 'new@example.com',
    first_name: 'New',
    last_name: 'Mech',
    phone: '9998887775',
    role: 'mechanic',
    password: 'password123',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 12,
    username: 'tow_ramesh',
    email: 'ramesh@example.com',
    first_name: 'Ramesh',
    last_name: 'Tow',
    phone: '9998887776',
    role: 'tow',
    password: 'password123',
    created_at: new Date(Date.now() - 22 * 86400000).toISOString()
  },
  {
    id: 13,
    username: 'tow_kiran',
    email: 'kiran@example.com',
    first_name: 'Kiran',
    last_name: 'HeavyTow',
    phone: '9998887777',
    role: 'tow',
    password: 'password123',
    created_at: new Date(Date.now() - 19 * 86400000).toISOString()
  }
];

export const mechanicProfiles = [
  {
    id: 1,
    user_id: 7,
    skills: 'Engine, Tyres, Battery',
    experience_years: 5,
    service_radius_km: 20,
    is_available: true,
    is_approved: true,
    lat: 12.9780,
    lng: 77.5910,
    bio: 'Experienced bike & car mechanic with 5 years in automotive repairs.',
    total_jobs: 24,
    total_earnings: 12500,
    created_at: new Date(Date.now() - 28 * 86400000).toISOString()
  },
  {
    id: 2,
    user_id: 8,
    skills: 'AC Repair, Engine, Electrical',
    experience_years: 8,
    service_radius_km: 25,
    is_available: true,
    is_approved: true,
    lat: 12.9650,
    lng: 77.6020,
    bio: 'Specialist in AC repairs and diagnostics.',
    total_jobs: 32,
    total_earnings: 18000,
    created_at: new Date(Date.now() - 24 * 86400000).toISOString()
  },
  {
    id: 3,
    user_id: 9,
    skills: 'Tyres, Towing, Battery',
    experience_years: 3,
    service_radius_km: 15,
    is_available: false,
    is_approved: true,
    lat: 12.9820,
    lng: 77.5850,
    bio: 'Quick roadside emergency fixes.',
    total_jobs: 15,
    total_earnings: 7500,
    created_at: new Date(Date.now() - 18 * 86400000).toISOString()
  },
  {
    id: 4,
    user_id: 10,
    skills: 'Full Service, Engine, Suspension',
    experience_years: 10,
    service_radius_km: 30,
    is_available: true,
    is_approved: true,
    lat: 12.9600,
    lng: 77.5890,
    bio: 'Over 10 years working on luxury and passenger vehicles.',
    total_jobs: 45,
    total_earnings: 24000,
    created_at: new Date(Date.now() - 12 * 86400000).toISOString()
  },
  {
    id: 5,
    user_id: 11,
    skills: 'Battery, Basic Repair',
    experience_years: 1,
    service_radius_km: 10,
    is_available: false,
    is_approved: false,
    lat: 12.9716,
    lng: 77.5946,
    bio: 'Newly registered technician awaiting verification.',
    total_jobs: 0,
    total_earnings: 0,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 6,
    user_id: 12,
    skills: 'Flatbed Towing, Winching',
    experience_years: 6,
    service_radius_km: 35,
    is_available: true,
    is_approved: true,
    lat: 12.9750,
    lng: 77.6100,
    bio: '24/7 Flatbed towing service.',
    total_jobs: 18,
    total_earnings: 15000,
    created_at: new Date(Date.now() - 22 * 86400000).toISOString()
  },
  {
    id: 7,
    user_id: 13,
    skills: 'Heavy Towing, Accident Recovery',
    experience_years: 9,
    service_radius_km: 40,
    is_available: true,
    is_approved: true,
    lat: 12.9550,
    lng: 77.5750,
    bio: 'Heavy vehicle and highway recovery specialist.',
    total_jobs: 29,
    total_earnings: 28000,
    created_at: new Date(Date.now() - 19 * 86400000).toISOString()
  }
];

export const bookings = [
  {
    id: 1,
    customer_id: 2, // rahul
    mechanic_id: 1, // mech_raj profile
    vehicle_type: 'car',
    issue_description: 'Engine won\'t start, suspected dead battery',
    urgency: 'high',
    service_type: 'mechanic',
    customer_lat: 12.9750,
    customer_lng: 77.5920,
    customer_address: 'MG Road, Bangalore',
    status: 'completed',
    service_charge: '550',
    distance_km: 0.35,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  },
  {
    id: 2,
    customer_id: 3, // priya
    mechanic_id: 2, // mech_suresh
    vehicle_type: 'car',
    issue_description: 'AC blowing hot air and strange hissing noise',
    urgency: 'medium',
    service_type: 'mechanic',
    customer_lat: 12.9670,
    customer_lng: 77.6010,
    customer_address: 'Indiranagar 100ft Road, Bangalore',
    status: 'in_progress',
    service_charge: '800',
    distance_km: 0.25,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString()
  },
  {
    id: 3,
    customer_id: 4, // amit
    mechanic_id: 6, // tow_ramesh
    vehicle_type: 'car',
    issue_description: 'Transmission failure on flyover, need towing to garage',
    urgency: 'emergency',
    service_type: 'tow',
    customer_lat: 12.9730,
    customer_lng: 77.6080,
    customer_address: 'Richmond Circle, Bangalore',
    status: 'en_route',
    service_charge: '1200',
    distance_km: 0.3,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString()
  },
  {
    id: 4,
    customer_id: 5, // neha
    mechanic_id: 1, // mech_raj
    vehicle_type: 'bike',
    issue_description: 'Flat tire near metro station',
    urgency: 'medium',
    service_type: 'mechanic',
    customer_lat: 12.9790,
    customer_lng: 77.5900,
    customer_address: 'Cubbon Park Metro, Bangalore',
    status: 'pending',
    service_charge: '350',
    distance_km: 0.15,
    created_at: new Date(Date.now() - 15 * 60000).toISOString()
  }
];

export const messages = [
  {
    id: 1,
    booking_id: 1,
    sender_id: 2,
    content: 'Hi Rajesh, are you coming soon?',
    timestamp: new Date(Date.now() - 3 * 86400000 + 300000).toISOString(),
    is_read: true
  },
  {
    id: 2,
    booking_id: 1,
    sender_id: 7,
    content: 'Yes Rahul! I have reached your spot, waiting near the red gate.',
    timestamp: new Date(Date.now() - 3 * 86400000 + 600000).toISOString(),
    is_read: true
  },
  {
    id: 3,
    booking_id: 2,
    sender_id: 3,
    content: 'Hi Suresh, did you find the leak in the AC pipe?',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    is_read: true
  },
  {
    id: 4,
    booking_id: 2,
    sender_id: 8,
    content: 'Yes Priya, fixing the seal right now. Should be done in 15 mins!',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    is_read: true
  },
  {
    id: 5,
    booking_id: 3,
    sender_id: 12,
    content: 'On my way Amit! Expect me in 7 minutes with the flatbed truck.',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    is_read: true
  }
];

export const reviews = [
  {
    id: 1,
    booking_id: 1,
    rating: 5,
    comment: 'Super fast arrival! Fixed my dead battery in 10 minutes. Highly recommended.',
    created_at: new Date(Date.now() - 3 * 86400000 + 7200000).toISOString()
  }
];

// Helper to serialize user
export function serializeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    phone: user.phone || '',
    role: user.role,
    profile_picture: user.profile_picture || null,
    created_at: user.created_at
  };
}

// Helper to serialize mechanic profile
export function serializeMechanicProfile(profile, distance_km = null) {
  if (!profile) return null;
  const user = users.find((u) => u.id === profile.user_id);
  return {
    id: profile.id,
    user: serializeUser(user),
    skills: profile.skills,
    experience_years: profile.experience_years,
    service_radius_km: profile.service_radius_km,
    is_available: profile.is_available,
    is_approved: profile.is_approved,
    lat: profile.lat,
    lng: profile.lng,
    bio: profile.bio || '',
    total_jobs: profile.total_jobs,
    total_earnings: profile.total_earnings,
    distance_km: distance_km !== null ? distance_km : (profile.distance_km || null),
    created_at: profile.created_at
  };
}

const statusDisplayMap = {
  pending: 'Pending',
  accepted: 'Accepted',
  en_route: 'En Route',
  arrived: 'Arrived',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected'
};

// Helper to serialize booking
export function serializeBooking(booking) {
  if (!booking) return null;
  const customer = users.find((u) => u.id === booking.customer_id);
  const profile = booking.mechanic_id ? mechanicProfiles.find((p) => p.id === booking.mechanic_id) : null;
  const review = reviews.find((r) => r.booking_id === booking.id);

  return {
    id: booking.id,
    customer: serializeUser(customer),
    mechanic: serializeMechanicProfile(profile, booking.distance_km),
    status: booking.status,
    status_display: statusDisplayMap[booking.status] || booking.status,
    service_type: booking.service_type || 'mechanic',
    vehicle_type: booking.vehicle_type,
    issue_description: booking.issue_description,
    urgency: booking.urgency || 'medium',
    customer_lat: booking.customer_lat,
    customer_lng: booking.customer_lng,
    customer_address: booking.customer_address || '',
    mechanic_lat: profile ? profile.lat : null,
    mechanic_lng: profile ? profile.lng : null,
    service_charge: booking.service_charge || '500',
    distance_km: booking.distance_km != null ? booking.distance_km : null,
    review: review || null,
    created_at: booking.created_at
  };
}

export function serializeMessage(message) {
  if (!message) return null;
  const sender = users.find((u) => u.id === message.sender_id);
  return {
    id: message.id,
    booking: message.booking_id,
    sender: message.sender_id,
    sender_username: sender ? sender.username : 'Unknown',
    sender_role: sender ? sender.role : 'customer',
    content: message.content,
    timestamp: message.timestamp,
    is_read: message.is_read
  };
}

// Find nearest provider
export function findNearestProvider(custLat, custLng, role = 'mechanic', radiusKm = 25, excludeProfileId = null) {
  let candidates = mechanicProfiles.filter((p) => {
    if (excludeProfileId && p.id === excludeProfileId) return false;
    const user = users.find((u) => u.id === p.user_id);
    if (!user || user.role !== role) return false;
    if (!p.is_available) return false;
    if (role === 'mechanic' && !p.is_approved) return false;
    if (p.lat == null || p.lng == null) return false;
    return true;
  });

  let nearest = null;
  let minDist = Infinity;

  for (const p of candidates) {
    const dist = haversine(custLat, custLng, p.lat, p.lng);
    const maxRadius = p.service_radius_km || radiusKm;
    if (dist <= maxRadius && dist < minDist) {
      minDist = dist;
      nearest = p;
    }
  }

  return nearest ? { profile: nearest, distance_km: Math.round(minDist * 100) / 100 } : { profile: null, distance_km: null };
}

// Get providers within radius
export function getProvidersWithinRadius(custLat, custLng, radiusKm = 30, role = 'mechanic') {
  const candidates = mechanicProfiles.filter((p) => {
    const user = users.find((u) => u.id === p.user_id);
    if (!user || user.role !== role) return false;
    if (!p.is_available) return false;
    if (role === 'mechanic' && !p.is_approved) return false;
    if (p.lat == null || p.lng == null) return false;
    return true;
  });

  const results = [];
  for (const p of candidates) {
    const dist = custLat != null && custLng != null ? haversine(custLat, custLng, p.lat, p.lng) : null;
    if (dist == null || dist <= (p.service_radius_km || radiusKm)) {
      results.push({
        profile: p,
        distance_km: dist != null ? Math.round(dist * 100) / 100 : null
      });
    }
  }

  results.sort((a, b) => (a.distance_km || 999) - (b.distance_km || 999));
  return results.map((r) => serializeMechanicProfile(r.profile, r.distance_km));
}

// ID generators
export function generateUserId() { return nextUserId++; }
export function generateProfileId() { return nextProfileId++; }
export function generateBookingId() { return nextBookingId++; }
export function generateMessageId() { return nextMessageId++; }
export function generateReviewId() { return nextReviewId++; }
