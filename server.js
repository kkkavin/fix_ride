import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import {
  users,
  mechanicProfiles,
  bookings,
  messages,
  reviews,
  serializeUser,
  serializeMechanicProfile,
  serializeBooking,
  serializeMessage,
  findNearestProvider,
  getProvidersWithinRadius,
  generateUserId,
  generateProfileId,
  generateBookingId,
  generateMessageId,
  generateReviewId
} from './data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fixride-secret-key-12345';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static assets
app.use('/static', express.static(path.join(__dirname, 'static')));

// Auth Helper Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const user = users.find((u) => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    req.user = user;
    next();
  });
}

function optionalToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      const user = users.find((u) => u.id === decoded.id);
      if (user) req.user = user;
    }
    next();
  });
}

// ─────────────────────────────────────────────────────────────
// HTML Page Routes
// ─────────────────────────────────────────────────────────────
const renderPage = (view) => (req, res) => res.render(view);

app.get('/', renderPage('index'));
app.get('/auth/login', renderPage('auth/login'));
app.get('/auth/login/', renderPage('auth/login'));
app.get('/auth/register', renderPage('auth/register'));
app.get('/auth/register/', renderPage('auth/register'));
app.get('/customer/dashboard', renderPage('customer/dashboard'));
app.get('/customer/dashboard/', renderPage('customer/dashboard'));
app.get('/mechanic/dashboard', renderPage('mechanic/dashboard'));
app.get('/mechanic/dashboard/', renderPage('mechanic/dashboard'));
app.get('/admin-panel', renderPage('admin/dashboard'));
app.get('/admin-panel/', renderPage('admin/dashboard'));
app.get('/tow/dashboard', renderPage('tow/dashboard'));
app.get('/tow/dashboard/', renderPage('tow/dashboard'));
app.get('/sos', renderPage('sos'));
app.get('/sos/', renderPage('sos'));

// ─────────────────────────────────────────────────────────────
// API Auth Endpoints
// ─────────────────────────────────────────────────────────────
app.post(['/api/auth/register', '/api/auth/register/'], (req, res) => {
  const { username, email, first_name, last_name, phone, password, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const existing = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  const userRole = role === 'mechanic' || role === 'tow' || role === 'admin' ? role : 'customer';

  const newUser = {
    id: generateUserId(),
    username,
    email: email || `${username}@example.com`,
    first_name: first_name || '',
    last_name: last_name || '',
    phone: phone || '',
    role: userRole,
    password,
    created_at: new Date().toISOString()
  };

  users.push(newUser);

  // If mechanic or tow, create initial profile
  if (userRole === 'mechanic' || userRole === 'tow') {
    mechanicProfiles.push({
      id: generateProfileId(),
      user_id: newUser.id,
      skills: userRole === 'tow' ? 'Towing, Roadside Assist' : 'General Repairs',
      experience_years: 1,
      service_radius_km: 25,
      is_available: false,
      is_approved: userRole === 'tow', // Tow operators auto-approved or pending based on app convention
      lat: 12.9716,
      lng: 77.5946,
      bio: '',
      total_jobs: 0,
      total_earnings: 0,
      created_at: new Date().toISOString()
    });
  }

  const token = jwt.sign({ id: newUser.id, username: newUser.username, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '30d' });

  res.status(201).json({
    message: 'User registered successfully',
    access: token,
    refresh: refreshToken,
    user: serializeUser(newUser),
    role: newUser.role,
    user_id: newUser.id
  });
});

app.post(['/api/auth/login', '/api/auth/login/'], (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });

  res.json({
    access: token,
    refresh: refreshToken,
    role: user.role,
    user_id: user.id,
    user: serializeUser(user)
  });
});

app.post(['/api/auth/guest/login', '/api/auth/guest/login/'], (req, res) => {
  const guestNum = Math.floor(1000 + Math.random() * 9000);
  const guestUsername = `guest_${guestNum}`;

  const guestUser = {
    id: generateUserId(),
    username: guestUsername,
    email: `${guestUsername}@fixride.local`,
    first_name: 'Guest',
    last_name: 'User',
    phone: '',
    role: 'customer',
    password: 'guestpassword',
    created_at: new Date().toISOString()
  };

  users.push(guestUser);

  const token = jwt.sign({ id: guestUser.id, username: guestUser.username, role: 'customer' }, JWT_SECRET, { expiresIn: '1d' });
  const refreshToken = jwt.sign({ id: guestUser.id }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    access: token,
    refresh: refreshToken,
    role: 'customer',
    user_id: guestUser.id,
    user: serializeUser(guestUser)
  });
});

app.post(['/api/auth/token/refresh', '/api/auth/token/refresh/'], (req, res) => {
  const { refresh } = req.body;
  if (!refresh) return res.status(400).json({ error: 'Refresh token required' });

  jwt.verify(refresh, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid refresh token' });
    const user = users.find((u) => u.id === decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const newAccess = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ access: newAccess });
  });
});

app.get(['/api/auth/me', '/api/auth/me/', '/api/auth/profile', '/api/auth/profile/'], authenticateToken, (req, res) => {
  res.json(serializeUser(req.user));
});

app.put(['/api/auth/profile', '/api/auth/profile/'], authenticateToken, (req, res) => {
  const { first_name, last_name, email, phone } = req.body;
  if (first_name !== undefined) req.user.first_name = first_name;
  if (last_name !== undefined) req.user.last_name = last_name;
  if (email !== undefined) req.user.email = email;
  if (phone !== undefined) req.user.phone = phone;

  res.json(serializeUser(req.user));
});

// ─────────────────────────────────────────────────────────────
// API Mechanics & Tow Endpoints
// ─────────────────────────────────────────────────────────────
app.get(['/api/mechanics/profile', '/api/mechanics/profile/'], authenticateToken, (req, res) => {
  let profile = mechanicProfiles.find((p) => p.user_id === req.user.id);
  if (!profile) {
    profile = {
      id: generateProfileId(),
      user_id: req.user.id,
      skills: 'General Repair',
      experience_years: 1,
      service_radius_km: 20,
      is_available: false,
      is_approved: req.user.role === 'tow',
      lat: 12.9716,
      lng: 77.5946,
      bio: '',
      total_jobs: 0,
      total_earnings: 0,
      created_at: new Date().toISOString()
    };
    mechanicProfiles.push(profile);
  }
  res.json(serializeMechanicProfile(profile));
});

app.put(['/api/mechanics/profile', '/api/mechanics/profile/'], authenticateToken, (req, res) => {
  let profile = mechanicProfiles.find((p) => p.user_id === req.user.id);
  if (!profile) {
    profile = {
      id: generateProfileId(),
      user_id: req.user.id,
      skills: '',
      experience_years: 0,
      service_radius_km: 20,
      is_available: false,
      is_approved: req.user.role === 'tow',
      lat: 12.9716,
      lng: 77.5946,
      bio: '',
      total_jobs: 0,
      total_earnings: 0,
      created_at: new Date().toISOString()
    };
    mechanicProfiles.push(profile);
  }

  const { skills, experience_years, service_radius_km, bio, lat, lng } = req.body;
  if (skills !== undefined) profile.skills = skills;
  if (experience_years !== undefined) profile.experience_years = Number(experience_years);
  if (service_radius_km !== undefined) profile.service_radius_km = Number(service_radius_km);
  if (bio !== undefined) profile.bio = bio;
  if (lat !== undefined) profile.lat = parseFloat(lat);
  if (lng !== undefined) profile.lng = parseFloat(lng);

  res.json(serializeMechanicProfile(profile));
});

app.post(['/api/mechanics/availability', '/api/mechanics/availability/'], authenticateToken, (req, res) => {
  let profile = mechanicProfiles.find((p) => p.user_id === req.user.id);
  if (!profile) {
    profile = {
      id: generateProfileId(),
      user_id: req.user.id,
      skills: 'General Repair',
      experience_years: 1,
      service_radius_km: 20,
      is_available: true,
      is_approved: req.user.role === 'tow',
      lat: 12.9716,
      lng: 77.5946,
      bio: '',
      total_jobs: 0,
      total_earnings: 0,
      created_at: new Date().toISOString()
    };
    mechanicProfiles.push(profile);
  }

  const { is_available, lat, lng, update_location_only } = req.body;
  if (lat !== undefined) profile.lat = parseFloat(lat);
  if (lng !== undefined) profile.lng = parseFloat(lng);

  if (!update_location_only) {
    profile.is_available = is_available !== undefined ? Boolean(is_available) : !profile.is_available;
  }

  res.json({
    status: 'success',
    is_available: profile.is_available,
    lat: profile.lat,
    lng: profile.lng
  });
});

app.get(['/api/mechanics/nearby', '/api/mechanics/nearby/'], optionalToken, (req, res) => {
  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng) : null;
  const radius = req.query.radius ? parseFloat(req.query.radius) : 30;
  const serviceType = req.query.service_type || req.query.role || 'mechanic';

  const nearby = getProvidersWithinRadius(lat, lng, radius, serviceType);
  res.json(nearby);
});

// ─────────────────────────────────────────────────────────────
// API Bookings Endpoints
// ─────────────────────────────────────────────────────────────
app.post(['/api/bookings', '/api/bookings/'], authenticateToken, (req, res) => {
  const {
    vehicle_type,
    issue_description,
    urgency,
    customer_lat,
    customer_lng,
    customer_address,
    service_type
  } = req.body;

  const type = service_type === 'tow' ? 'tow' : 'mechanic';
  const cLat = parseFloat(customer_lat);
  const cLng = parseFloat(customer_lng);

  // Match nearest provider
  const { profile, distance_km } = findNearestProvider(cLat, cLng, type, 30);

  // Price estimate calculation
  let price = type === 'tow' ? 1000 : 450;
  if (urgency === 'emergency') price += 250;
  if (distance_km) price += Math.round(distance_km * 20);

  const newBooking = {
    id: generateBookingId(),
    customer_id: req.user.id,
    mechanic_id: profile ? profile.id : null,
    vehicle_type: vehicle_type || 'car',
    issue_description: issue_description || 'Assistance requested',
    urgency: urgency || 'medium',
    service_type: type,
    customer_lat: cLat,
    customer_lng: cLng,
    customer_address: customer_address || '',
    status: 'pending',
    service_charge: price.toString(),
    distance_km: distance_km,
    created_at: new Date().toISOString()
  };

  bookings.push(newBooking);

  const serialized = serializeBooking(newBooking);
  const message = profile
    ? `Booking created! Assigned to ${serialized.mechanic?.user?.username || 'provider'} (${distance_km || '?'} km away).`
    : 'Booking created! Waiting for an available provider.';

  res.status(201).json({
    message,
    booking: serialized,
    ...serialized
  });
});

app.get(['/api/bookings/my', '/api/bookings/my/'], authenticateToken, (req, res) => {
  let userBookings = [];

  if (req.user.role === 'customer') {
    userBookings = bookings.filter((b) => b.customer_id === req.user.id);
  } else if (req.user.role === 'mechanic' || req.user.role === 'tow') {
    const profile = mechanicProfiles.find((p) => p.user_id === req.user.id);
    if (profile) {
      userBookings = bookings.filter((b) => b.mechanic_id === profile.id);
    }
  } else if (req.user.role === 'admin') {
    userBookings = [...bookings];
  }

  // Sort by date descending
  userBookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(userBookings.map(serializeBooking));
});

app.get(['/api/bookings/:id', '/api/bookings/:id/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  res.json(serializeBooking(booking));
});

// Accept booking
app.all(['/api/bookings/:id/accept', '/api/bookings/:id/accept/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  booking.status = 'accepted';
  const serialized = serializeBooking(booking);

  res.json({
    message: 'Booking accepted',
    booking: serialized,
    ...serialized
  });
});

// Reject booking
app.all(['/api/bookings/:id/reject', '/api/bookings/:id/reject/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  // Try to reassign to next nearest provider
  const currentProfileId = booking.mechanic_id;
  const { profile, distance_km } = findNearestProvider(
    booking.customer_lat,
    booking.customer_lng,
    booking.service_type || 'mechanic',
    30,
    currentProfileId
  );

  if (profile) {
    booking.mechanic_id = profile.id;
    booking.distance_km = distance_km;
    booking.status = 'pending';
  } else {
    booking.status = 'rejected';
  }

  const serialized = serializeBooking(booking);
  res.json({
    message: 'Booking rejected and updated',
    booking: serialized,
    ...serialized
  });
});

// Update status
app.all(['/api/bookings/:id/status', '/api/bookings/:id/status/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  booking.status = status;

  if (status === 'completed' && booking.mechanic_id) {
    const profile = mechanicProfiles.find((p) => p.id === booking.mechanic_id);
    if (profile) {
      profile.total_jobs += 1;
      profile.total_earnings += parseFloat(booking.service_charge || 500);
    }
  }

  const serialized = serializeBooking(booking);
  res.json({
    message: `Booking status updated to ${status}`,
    booking: serialized,
    ...serialized
  });
});

// Review
app.post(['/api/bookings/:id/review', '/api/bookings/:id/review/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const booking = bookings.find((b) => b.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const { rating, comment } = req.body;
  const newReview = {
    id: generateReviewId(),
    booking_id: booking.id,
    rating: parseInt(rating, 10) || 5,
    comment: comment || '',
    created_at: new Date().toISOString()
  };

  reviews.push(newReview);
  res.status(201).json(newReview);
});

// Booking Chat Messages
app.get(['/api/bookings/:id/messages', '/api/bookings/:id/messages/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const bMessages = messages.filter((m) => m.booking_id === id);
  res.json(bMessages.map(serializeMessage));
});

app.post(['/api/bookings/:id/messages', '/api/bookings/:id/messages/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });

  const newMsg = {
    id: generateMessageId(),
    booking_id: id,
    sender_id: req.user.id,
    content,
    timestamp: new Date().toISOString(),
    is_read: false
  };

  messages.push(newMsg);
  res.status(201).json(serializeMessage(newMsg));
});

// Payment simulation endpoints
app.post(['/api/bookings/:id/create-order', '/api/bookings/:id/create-order/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const booking = bookings.find((b) => b.id === id);
  const amount = (parseFloat(booking?.service_charge || 500) * 100);

  res.json({
    order_id: `order_fixride_${id}_${Date.now()}`,
    amount,
    currency: 'INR'
  });
});

app.post(['/api/bookings/:id/verify-payment', '/api/bookings/:id/verify-payment/'], authenticateToken, (req, res) => {
  res.json({ status: 'success', message: 'Payment verified successfully' });
});

// ─────────────────────────────────────────────────────────────
// Admin Control API
// ─────────────────────────────────────────────────────────────
app.get(['/api/bookings/admin/dashboard', '/api/bookings/admin/dashboard/'], authenticateToken, (req, res) => {
  const totalUsers = users.length;
  const totalMechanics = mechanicProfiles.filter((p) => {
    const u = users.find((x) => x.id === p.user_id);
    return u && (u.role === 'mechanic' || u.role === 'tow');
  }).length;
  const totalBookings = bookings.length;
  const completedBookings = bookings.filter((b) => b.status === 'completed').length;
  const activeBookings = bookings.filter((b) => ['accepted', 'en_route', 'arrived', 'in_progress'].includes(b.status)).length;
  const pendingApprovals = mechanicProfiles.filter((p) => !p.is_approved).length;

  const totalRevenue = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + parseFloat(b.service_charge || 0), 0);

  const recent = [...bookings]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10)
    .map(serializeBooking);

  res.json({
    stats: {
      total_users: totalUsers,
      total_mechanics: totalMechanics,
      total_bookings: totalBookings,
      completed_bookings: completedBookings,
      total_revenue: totalRevenue,
      active_bookings: activeBookings,
      pending_mechanic_approval: pendingApprovals
    },
    recent_bookings: recent
  });
});

app.get(['/api/bookings/admin/users', '/api/bookings/admin/users/'], authenticateToken, (req, res) => {
  res.json(users.map(serializeUser));
});

app.all(['/api/bookings/admin/users/:id/delete', '/api/bookings/admin/users/:id/delete/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = users.findIndex((u) => u.id === id);
  if (index !== -1) {
    users.splice(index, 1);
  }
  res.json({ message: 'User deleted successfully' });
});

app.get(['/api/bookings/admin/mechanics', '/api/bookings/admin/mechanics/'], authenticateToken, (req, res) => {
  res.json(mechanicProfiles.map((p) => serializeMechanicProfile(p)));
});

app.all(['/api/bookings/admin/mechanics/:id/approve', '/api/bookings/admin/mechanics/:id/approve/'], authenticateToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const profile = mechanicProfiles.find((p) => p.id === id);
  if (!profile) return res.status(404).json({ error: 'Mechanic profile not found' });

  const { action } = req.body;
  if (action === 'reject') {
    profile.is_approved = false;
  } else {
    profile.is_approved = true;
  }

  res.json({
    message: profile.is_approved ? 'Mechanic access granted' : 'Mechanic access revoked',
    is_approved: profile.is_approved
  });
});

// ─────────────────────────────────────────────────────────────
// Chatbot AI Assistant
// ─────────────────────────────────────────────────────────────
const CHATBOT_RULES = {
  book: "To book a mechanic or tow, open your Customer Dashboard and click 'Find Nearest Mechanic' or 'Find Nearest Tow'. Provide your location and issue description. Our system matches the closest provider immediately!",
  mechanic: "Our mechanics and technicians are verified professionals skilled in battery jumpstarts, tire replacements, engine repair, and AC servicing.",
  tow: "Need a tow? Select the 'Tow Service' option on your dashboard or the SOS page. Our network of flatbed and heavy recovery operators will reach you quickly.",
  track: "You can track your service status and live provider location in real-time right on your Customer Dashboard.",
  payment: "We provide upfront transparent estimates and support simulated online payments (UPI, Card, Net Banking) or direct cash on service.",
  cancel: "You can cancel any booking before the provider arrives directly from your active booking timeline.",
  review: "After your service is marked complete, you can leave a star rating and feedback to help maintain quality across the platform.",
  register: "Click 'Register' on the top right. Select your role (Customer, Mechanic, or Tow Operator) to get started.",
  login: "Click 'Login' in the navigation bar. You can log in as a registered user or use the Instant Guest access.",
  price: "Standard estimates: Basic diagnostic ₹200-500, Flat tire change ₹300-600, Battery jump ₹300-600, Towing ₹800-1500.",
  tyre: "Stranded with a flat tire? Select 'Emergency' urgency when booking. Our mobile technicians carry jacks, inflators, and puncture kits.",
  battery: "Dead battery? Request a jump-start on your dashboard for fast on-site assistance.",
  hello: "Hello! Welcome to Fix Ride 👋 I am your roadside assistant. How can I assist you today?",
  hi: "Hi there! 👋 I can help you with bookings, nearest mechanics, towing, pricing, or tracking.",
  help: "You can ask me about: 'book', 'tow', 'track', 'pricing', 'battery', 'tyre', or 'cancel'!"
};

const DEFAULT_RESPONSE = "I'm not sure I understood that. You can ask about: 'book', 'tow', 'track', 'pricing', 'battery', 'tyre', 'payment', or type 'help'.";

app.post(['/api/chatbot', '/api/chatbot/'], (req, res) => {
  const msg = (req.body.message || '').toLowerCase().trim();
  if (!msg) {
    return res.json({ reply: 'Please type a message.' });
  }

  for (const [keyword, reply] of Object.entries(CHATBOT_RULES)) {
    if (msg.includes(keyword)) {
      return res.json({ reply });
    }
  }

  res.json({ reply: DEFAULT_RESPONSE });
});

// Fallback for SPA/views
app.get('*', (req, res) => {
  res.render('index');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fix Ride server running on http://0.0.0.0:${PORT}`);
});
