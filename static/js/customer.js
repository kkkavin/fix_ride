let map = null, marker = null, providerMarker = null;
let statusMap = null, statusMarker = null, statusProviderMarker = null;
let activeBookingId = null, pollInterval = null;
let trackInterval = null, selectedRating = 0;
let bookingServiceType = 'mechanic'; // 'mechanic' | 'tow'
let selectedChatBookingId = null;

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(['customer'])) return;
  loadProfile();
  initMap();
  loadBookings();
  await loadActiveBooking();
  startPolling();
  loadChatList();
});

// ── Service type selector ──────────────────────────────────
function selectServiceType(type) {
  bookingServiceType = type;
  document.getElementById('btnMechanic').classList.toggle('active', type === 'mechanic');
  document.getElementById('btnTow').classList.toggle('active', type === 'tow');

  const bookBtnEl = document.getElementById('bookBtn');
  const nearbyLabel = document.getElementById('nearbyLabel');
  const sidebarNearby = document.getElementById('nav-nearby');

  if (type === 'mechanic') {
    bookBtnEl.textContent = '🔧 Find Nearest Mechanic';
    if (nearbyLabel) nearbyLabel.textContent = '📍 Nearby Mechanics';
    if (sidebarNearby) sidebarNearby.innerHTML = '<span class="icon">📍</span> Nearby Mechanics';
  } else {
    bookBtnEl.textContent = '🚛 Find Nearest Tow';
    if (nearbyLabel) nearbyLabel.textContent = '📍 Nearby Tow Drivers';
    if (sidebarNearby) sidebarNearby.innerHTML = '<span class="icon">📍</span> Nearby Tow Drivers';
  }
  loadNearby();
}

// ── Map ────────────────────────────────────────────────────
function initMap() {
  // Booking Map
  map = L.map('map').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // Status/Tracking Map
  statusMap = L.map('statusMap').setView([20.5937, 78.9629], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(statusMap);
}

function detectLocation() {
  const btn = document.getElementById('gpsBtn');
  btn.textContent = '⏳ Locating...';
  btn.disabled = true;
  if (!navigator.geolocation) {
    showToast('Geolocation not supported', 'error');
    btn.textContent = '📍 GPS'; btn.disabled = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    document.getElementById('customerLat').value = lat;
    document.getElementById('customerLng').value = lng;
    document.getElementById('locationStatus').textContent = `✅ Location detected: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    map.setView([lat, lng], 15);
    if (marker) marker.remove();
    // Customer = pulsing blue circle
    marker = L.circleMarker([lat, lng], {
      radius: 10, color: '#2563eb', fillColor: '#3b82f6',
      fillOpacity: 0.8, weight: 3
    }).addTo(map).bindPopup('📍 Your Location').openPopup();
    btn.textContent = '📍 GPS'; btn.disabled = false;
    showToast('Location detected!', 'success');
    
    // Update status map background if it exists
    if (statusMap) statusMap.setView([lat, lng], 13);

    loadNearby();
  }, () => {
    showToast('Could not get location. Please enter your address.', 'error');
    btn.textContent = '📍 GPS'; btn.disabled = false;
  });
}

// ── Booking ────────────────────────────────────────────────
async function submitBooking(e) {
  e.preventDefault();
  const lat = document.getElementById('customerLat').value;
  const lng = document.getElementById('customerLng').value;
  if (!lat || !lng) { showToast('Please detect your location first (GPS button)', 'error'); return; }

  const btn = document.getElementById('bookBtn');
  btn.disabled = true;
  btn.textContent = bookingServiceType === 'tow' ? '🔍 Finding nearest tow driver...' : '🔍 Finding nearest mechanic...';

  const payload = {
    vehicle_type: document.getElementById('vehicleType').value,
    issue_description: document.getElementById('issueDesc').value,
    customer_lat: parseFloat(lat),
    customer_lng: parseFloat(lng),
    customer_address: document.getElementById('customerAddress').value,
    service_type: bookingServiceType
  };

  const r = await apiRequest('/api/bookings/', 'POST', payload);
  if (r && r.ok) {
    const data = await r.json();
    showToast(data.message || 'Booking created!', 'success');
    activeBookingId = data.booking.id;
    localStorage.setItem('active_booking_id', activeBookingId);
    localStorage.setItem('active_booking_type', bookingServiceType);
    updateBookingDisplay(data.booking);
    updateProviderLiveLocation(data.booking);
    loadBookings();
    showSection('status');
    document.getElementById('bookingForm').reset();
    document.getElementById('locationStatus').textContent = '';
    if (marker) marker.remove();
  } else if (r) {
    const err = await r.json();
    showToast(JSON.stringify(err), 'error');
  }
  btn.disabled = false;
  btn.textContent = bookingServiceType === 'tow' ? '🚛 Find Nearest Tow' : '🔧 Find Nearest Mechanic';
}

// ── Polling ────────────────────────────────────────────────
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(pollBookingStatus, 1500); // Near-instant tracking (1.5s)
}

async function pollBookingStatus() {
  const id = activeBookingId || localStorage.getItem('active_booking_id');
  if (!id) return;
  const r = await apiRequest(`/api/bookings/${id}/`);
  if (r && r.ok) {
    const booking = await r.json();
    updateBookingDisplay(booking);
    updateProviderLiveLocation(booking);
    if (['completed', 'cancelled', 'rejected'].includes(booking.status)) {
      clearInterval(pollInterval);
      clearInterval(trackInterval);
      if (providerMarker) { providerMarker.remove(); providerMarker = null; }
      if (booking.status === 'completed') {
        document.getElementById('rateBtn')?.classList.remove('hidden');
        if (!localStorage.getItem('paid_' + id)) {
          openPaymentModal(booking);
        }
      } else {
        // For cancelled or rejected, immediately clear the tracker
        const msg = (booking.status === 'rejected') ? 'Booking was rejected by the provider' : 'Booking was cancelled';
        showToast(msg, 'info');

        document.getElementById('activeBookingBadge')?.classList.add('hidden');
        document.getElementById('activeBookingInfo').style.display = 'block';
        document.getElementById('statusTimeline').style.display = 'none';
        document.getElementById('cancelBookingArea').classList.add('hidden');
        document.getElementById('assignedMechanicCard').classList.add('hidden');
        document.getElementById('bookingStatusBadge').className = 'badge badge-pending';
        document.getElementById('bookingStatusBadge').textContent = 'No Booking';
      }
    }
  }
}

async function loadActiveBooking() {
  const id = localStorage.getItem('active_booking_id');
  if (!id) return;
  activeBookingId = id;
  const r = await apiRequest(`/api/bookings/${id}/`);
  if (r && r.ok) {
    const booking = await r.json();
    updateBookingDisplay(booking);
    updateProviderLiveLocation(booking);
  }
}

// ── Live location tracking of provider ───────────────────
function updateProviderLiveLocation(booking) {
  if (!statusMap) return;
  const providerLat = booking.mechanic_lat;
  const providerLng = booking.mechanic_lng;

  // Show map if we have any relevant info
  const mapEl = document.getElementById('statusMap');
  if (mapEl) { mapEl.style.display = 'block'; statusMap.invalidateSize(); }

  // Customer marker on status map
  const custLat = parseFloat(document.getElementById('customerLat')?.value || booking.customer_lat);
  const custLng = parseFloat(document.getElementById('customerLng')?.value || booking.customer_lng);

  if (custLat && custLng) {
    if (statusMarker) statusMarker.remove();
    statusMarker = L.circleMarker([custLat, custLng], {
      radius: 12, color: '#1d4ed8', fillColor: '#3b82f6',
      fillOpacity: 0.85, weight: 3
    }).addTo(statusMap).bindPopup('Your Location');
  }

  if (!providerLat || !providerLng) {
    // If no provider yet, just show customer
    if (custLat && custLng) statusMap.setView([custLat, custLng], 14);
    return;
  }

  const icon = (booking.service_type === 'tow')
    ? L.divIcon({ html: '<div style="font-size:1.6rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚛</div>', className: '', iconSize: [32, 32], iconAnchor: [16, 16] })
    : L.divIcon({ html: '<div style="font-size:1.6rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🔧</div>', className: '', iconSize: [32, 32], iconAnchor: [16, 16] });

  if (statusProviderMarker) {
    statusProviderMarker.setLatLng([providerLat, providerLng]);
  } else {
    statusProviderMarker = L.marker([providerLat, providerLng], { icon }).addTo(statusMap);
  }

  const name = booking.mechanic?.user?.username || (booking.service_type === 'tow' ? 'Tow Driver' : 'Mechanic');
  statusProviderMarker.bindPopup(`📍 ${name} (Live)`);

  // Fit both markers in view
  if (custLat && custLng) {
    const bounds = L.latLngBounds([[providerLat, providerLng], [custLat, custLng]]);
    statusMap.fitBounds(bounds, { padding: [50, 50] });
  } else {
    statusMap.setView([providerLat, providerLng], 14);
  }
}

let lastBookingStatus = null;

function updateBookingDisplay(booking) {
  // Focus-safe check
  const currentState = JSON.stringify({ id: booking.id, status: booking.status });
  if (currentState === lastBookingStatus) return;
  lastBookingStatus = currentState;

  const statusBadgeEl = document.getElementById('bookingStatusBadge');
  const infoEl = document.getElementById('activeBookingInfo');
  const timeline = document.getElementById('statusTimeline');
  const mechCard = document.getElementById('assignedMechanicCard');
  const activeBadge = document.getElementById('activeBookingBadge');
  const navStatus = document.getElementById('nav-status');
  const cancelArea = document.getElementById('cancelBookingArea');
  
  if (statusBadgeEl) {
    statusBadgeEl.className = `badge badge-${booking.status}`;
    statusBadgeEl.textContent = booking.status.replace('_', ' ').toUpperCase();
  }
  
  const activeStatuses = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress'];
  
  if (!activeStatuses.includes(booking.status) && booking.status !== 'completed') {
    // If not active and not completed (meaning cancelled or rejected), collapse UI
    if (infoEl) infoEl.style.display = 'block';
    if (timeline) timeline.style.display = 'none';
    if (activeBadge) activeBadge.classList.add('hidden');
    if (mechCard) mechCard.classList.add('hidden');
    if (cancelArea) cancelArea.classList.add('hidden');
    
    // Clear local storage so user can re-book
    localStorage.removeItem('active_booking_id');
    localStorage.removeItem('active_booking_type');
    activeBookingId = null;
    
    if (statusBadgeEl) {
      statusBadgeEl.className = 'badge badge-pending'; 
      statusBadgeEl.textContent = 'No Booking';
    }
    return;
  }

  if (infoEl) infoEl.style.display = 'none';
  if (timeline) timeline.style.display = 'flex';
  if (activeBadge) activeBadge.classList.remove('hidden');
  if (cancelArea) cancelArea.classList.toggle('hidden', ['completed','cancelled','rejected'].includes(booking.status));

  const order = ['pending', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed'];
  const currentIdx = order.indexOf(booking.status);
  order.forEach((s, i) => {
    const step = document.getElementById('step-' + s);
    if (!step) return;
    step.classList.remove('done', 'active');
    if (i < currentIdx) step.classList.add('done');
    else if (i === currentIdx) step.classList.add('active');
  });

  if (mechCard && booking.mechanic) {
    mechCard.classList.remove('hidden');
    const m = booking.mechanic;
    const name = m.user?.first_name ? `${m.user.first_name} ${m.user.last_name}` : m.user?.username || 'Provider';
    document.getElementById('mechName').textContent = name;
    document.getElementById('mechSkills').textContent = '🔧 ' + (m.skills || 'General Repair');
    const distText = (booking.distance_km !== null && booking.distance_km !== undefined) ? `📍 ${booking.distance_km} km away` : '';
    document.getElementById('mechDist').textContent = distText;
  } else if (mechCard && !booking.mechanic) {
    document.getElementById('mechName').textContent = 'Searching...';
    document.getElementById('mechSkills').textContent = 'Finding nearest provider';
    document.getElementById('mechDist').textContent = '';
  }
}

// ── Nearby Providers ───────────────────────────────────────
async function loadNearby() {
  const lat = document.getElementById('customerLat')?.value;
  const lng = document.getElementById('customerLng')?.value;
  if (!lat || !lng) { showToast('Detect your location first (GPS button on Book page)', 'info'); return; }

  const endpoint = bookingServiceType === 'tow'
    ? `/api/mechanics/nearby/?lat=${lat}&lng=${lng}&radius=25&role=tow`
    : `/api/mechanics/nearby/?lat=${lat}&lng=${lng}&radius=25`;

  const r = await apiRequest(endpoint, 'GET', null, false);
  if (!r || !r.ok) return;
  const data = await r.json();
  const list = document.getElementById('nearbyList');
  if (!list) return;

  const providers = data.mechanics || data.tow_operators || [];
  const icon = bookingServiceType === 'tow' ? '🚛' : '🔧';
  const label = bookingServiceType === 'tow' ? 'Tow Driver' : 'Mechanic';

  if (!providers.length) {
    list.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:2rem;">No ${label}s available nearby right now.</p>`;
    return;
  }
  list.innerHTML = providers.map(m => {
    const name = m.user?.first_name ? `${m.user.first_name} ${m.user.last_name}` : m.user?.username || label;
    const rating = m.average_rating ? `⭐ ${parseFloat(m.average_rating).toFixed(1)}` : '⭐ New';
    const skills = m.skills || 'General Service';
    const exp = m.experience_years ? `${m.experience_years}yr exp` : '';
    return `<div class="mechanic-card" style="cursor:pointer;" onclick="showProviderProfile(${JSON.stringify(m).replace(/"/g, '&quot;')})">
      <div class="mechanic-avatar">${icon}</div>
      <div class="mechanic-info">
        <div class="mechanic-name">${name}</div>
        <div class="mechanic-skills">${skills} ${exp ? '·' : ''} ${exp}</div>
        <div class="mechanic-distance">📍 ${m.distance_km} km away · ${rating}</div>
        <div style="margin-top:0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();viewProfileAndBook(${m.user?.id})">View Profile & Book</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Provider profile modal ─────────────────────────────────
function showProviderProfile(m) {
  const icon = bookingServiceType === 'tow' ? '🚛' : '🔧';
  const name = m.user?.first_name ? `${m.user.first_name} ${m.user.last_name}` : m.user?.username || 'Provider';
  const rating = m.average_rating ? `${parseFloat(m.average_rating).toFixed(1)} / 5.0` : 'No ratings yet';

  const modal = document.getElementById('providerProfileModal');
  document.getElementById('providerModalContent').innerHTML = `
    <div style="text-align:center;margin-bottom:1.5rem;">
      <div style="font-size:3.5rem;margin-bottom:0.5rem;">${icon}</div>
      <div style="font-size:1.2rem;font-weight:800;">${name}</div>
      <div style="color:var(--text-muted);font-size:0.875rem;">${m.user?.email || ''}</div>
    </div>
    <div class="grid-2" style="gap:1rem;margin-bottom:1rem;">
      <div style="background:var(--input-bg);border-radius:12px;padding:1rem;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem;">Rating</div>
        <div style="font-weight:700;color:var(--primary);">⭐ ${rating}</div>
      </div>
      <div style="background:var(--input-bg);border-radius:12px;padding:1rem;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem;">Experience</div>
        <div style="font-weight:700;">${m.experience_years || 0} years</div>
      </div>
      <div style="background:var(--input-bg);border-radius:12px;padding:1rem;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem;">Total Jobs</div>
        <div style="font-weight:700;">${m.total_jobs || 0}</div>
      </div>
      <div style="background:var(--input-bg);border-radius:12px;padding:1rem;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem;">Distance</div>
        <div style="font-weight:700;">📍 ${m.distance_km} km</div>
      </div>
    </div>
    <div style="background:var(--input-bg);border-radius:12px;padding:1rem;margin-bottom:1rem;">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">Skills</div>
      <div style="font-weight:600;">${m.skills || 'General Service'}</div>
    </div>
    ${m.bio ? `<div style="background:var(--input-bg);border-radius:12px;padding:1rem;margin-bottom:1rem;font-size:0.875rem;color:var(--text-muted);">"${m.bio}"</div>` : ''}
    <div style="background:var(--input-bg);border-radius:12px;padding:1rem;margin-bottom:1.5rem;">
      <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.25rem;">Service Radius</div>
      <div style="font-weight:700;">${m.service_radius_km || 15} km</div>
    </div>
    <div style="display:flex;gap:1rem;justify-content:center;">
      <button class="btn btn-secondary btn-lg" onclick="closeProviderModal()">Close</button>
      <button class="btn btn-primary btn-lg" onclick="closeProviderModal();showSection('book');">📋 Book Now</button>
    </div>
  `;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeProviderModal() {
  document.getElementById('providerProfileModal').classList.add('hidden');
  document.getElementById('providerProfileModal').style.display = 'none';
}

async function viewProfileAndBook(userId) {
  showSection('book');
  showToast('Fill in the form to book this provider!', 'info');
}

// ── Universal Messenger ─────────────────────────────────────
let chatPollInterval = null;

function stopChatPolling() {
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = null;
}

function startChatPolling() {
  stopChatPolling();
  chatPollInterval = setInterval(loadMessages, 1500); // Near-instant chat updates
}

async function loadChatList() {
  const r = await apiRequest('/api/bookings/my/');
  if (!r || !r.ok) return;
  const bookings = await r.json();
  const listEl = document.getElementById('chatList');
  if (!listEl) return;
  
  const assigned = bookings.filter(b => b.mechanic);
  if (!assigned.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">No active conversations. Book a service first.</div>';
    return;
  }
  
  // Group by Provider User ID to avoid duplicate people
  const uniqueProviders = {};
  assigned.forEach(b => {
    const pId = b.mechanic.user.id;
    // Keep the most recent booking for the chat
    if (!uniqueProviders[pId] || new Date(b.created_at) > new Date(uniqueProviders[pId].created_at)) {
      uniqueProviders[pId] = b;
    }
  });

  const chatItems = Object.values(uniqueProviders).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  listEl.innerHTML = chatItems.map(b => {
    const isMechanic = b.service_type === 'mechanic';
    const roleLabel = isMechanic ? 'Mechanic' : 'Tow Driver';
    const icon = isMechanic ? '🔧' : '🚛';
    const pName = b.mechanic.user?.first_name || b.mechanic.user?.username || 'Provider';
    const isActive = selectedChatBookingId === b.id ? 'background:var(--input-bg);border-left:4px solid var(--primary);' : 'border-left:4px solid transparent;';
    
    return `<div style="padding:1rem; cursor:pointer; border-bottom:1px solid var(--border); transition:all 0.2s; ${isActive}" 
                 onclick="selectChat(${b.id}, '${pName.replace(/'/g, "\\'")}', '${roleLabel}', '${b.status}')">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
        <span style="font-weight:700;">${icon} ${pName}</span>
        ${statusBadge(b.status)}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);">
         Booking #${b.id} · Recent: ${formatDate(b.created_at)}
      </div>
    </div>`;
  }).join('');
}

function selectChat(id, pname, role, status) {
  selectedChatBookingId = id;
  lastMessageCount = 0; // Reset for new chat
  document.getElementById('chatActiveHeader').textContent = `${pname} (${role})`;
  document.getElementById('chatActiveStatus').innerHTML = `Booking #${id} · Status: ${statusBadge(status)}`;
  
  const inp = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  inp.disabled = false;
  btn.disabled = false;
  
  // Reload the left pane to show active state
  loadChatList();
  
  // Load messages & start polling
  const container = document.getElementById('chatMessages');
  container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">Loading messages...</div>';
  loadMessages();
  startChatPolling();
}

async function loadMessages() {
  if (!selectedChatBookingId) return;
  
  const r = await apiRequest(`/api/bookings/${selectedChatBookingId}/messages/`);
  if (!r || !r.ok) return;
  const messages = await r.json();
  
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // Optimized render
  if (messages.length === lastMessageCount && container.innerHTML.trim() !== '' && !container.innerHTML.includes('Loading messages')) return;
  lastMessageCount = messages.length;

  const myUsername = localStorage.getItem('user_name');
  const atBottom = (container.scrollHeight - container.clientHeight) <= (container.scrollTop + 20);

  if (!messages.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;height:100%;display:flex;align-items:center;justify-content:center;">No messages here! Start the conversation. 👋</div>';
    return;
  }
  
  container.innerHTML = messages.map(m => {
    const isMine = m.sender_username === myUsername;
    return `<div class="chat-bubble ${isMine ? 'sent' : 'received'}">
      ${m.content}
      <div class="meta">${m.sender_username} · ${formatDate(m.timestamp)}</div>
    </div>`;
  }).join('');
  
  if (atBottom || lastMessageCount === messages.length) {
    container.scrollTop = container.scrollHeight;
  }
}

async function sendMessage() {
  if (!selectedChatBookingId) { showToast('Select a chat first.', 'info'); return; }
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;
  
  input.disabled = true;
  document.getElementById('chatSendBtn').disabled = true;
  
  const r = await apiRequest(`/api/bookings/${selectedChatBookingId}/messages/`, 'POST', { content });
  if (r && r.ok) {
    input.value = '';
    await loadMessages();
  } else {
    showToast('Could not send. Try again.', 'error');
  }
  
  input.disabled = false;
  document.getElementById('chatSendBtn').disabled = false;
  input.focus();
}

// ── Cancel Booking ─────────────────────────────────────────
async function cancelBooking() {
  const id = activeBookingId || localStorage.getItem('active_booking_id');
  if (!id) return;
  if (!confirm('Cancel this booking?')) return;
  const r = await apiRequest(`/api/bookings/${id}/status/`, 'PUT', { status: 'cancelled' });
  if (r && r.ok) {
    showToast('Booking cancelled.', 'info');
    localStorage.removeItem('active_booking_id');
    localStorage.removeItem('active_booking_type');
    activeBookingId = null;
    if (providerMarker) { providerMarker.remove(); providerMarker = null; }
    if (statusMarker) { statusMarker.remove(); statusMarker = null; }
    if (statusProviderMarker) { statusProviderMarker.remove(); statusProviderMarker = null; }
    const statusMapEl = document.getElementById('statusMap');
    if (statusMapEl) statusMapEl.style.display = 'none';
    loadBookings();
    
    // Hide tracking UI components
    document.getElementById('activeBookingInfo').style.display = 'block';
    document.getElementById('statusTimeline').style.display = 'none';
    document.getElementById('cancelBookingArea')?.classList.add('hidden');
    document.getElementById('assignedMechanicCard').classList.add('hidden');
    document.getElementById('bookingStatusBadge').className = 'badge badge-pending';
    document.getElementById('bookingStatusBadge').textContent = 'No Booking';
  }
}

function trackBooking(id) {
  activeBookingId = id;
  localStorage.setItem('active_booking_id', id);
  showSection('status');
  pollBookingStatus();
}

// ── My Bookings ────────────────────────────────────────────
async function loadBookings() {
  const r = await apiRequest('/api/bookings/my/');
  if (!r || !r.ok) return;
  const bookings = await r.json();
  const tbody = document.getElementById('bookingsBody');
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">No bookings yet.</td></tr>';
    return;
  }
  tbody.innerHTML = bookings.map(b => {
    const mName = b.mechanic ? (b.mechanic.user?.username || '-') : '-';
    let actionBtn = '';
    if (b.status === 'completed' && !b.review) {
       actionBtn = localStorage.getItem('paid_' + b.id)
         ? `<button class="btn btn-primary btn-sm" onclick="openReviewModal(${b.id})">⭐ Review</button>`
         : `<button class="btn btn-success btn-sm" onclick="openPaymentModal({id:${b.id}, service_charge:'${b.service_charge||''}'})">💳 Pay Now</button>`;
    } else if (!['completed','cancelled','rejected'].includes(b.status)) {
       actionBtn = `<button class="btn btn-secondary btn-sm" onclick="trackBooking(${b.id})">Track</button>`;
    }

    return `<tr>
      <td>#${b.id}</td>
      <td>${b.vehicle_type}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;">${b.issue_description}</td>
      <td>${statusBadge(b.status)}</td>
      <td>${mName}</td>
      <td>${formatDate(b.created_at)}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');
}

// ── Profile ────────────────────────────────────────────────
async function loadProfile() {
  const r = await apiRequest('/api/auth/profile/');
  if (!r || !r.ok) return;
  const user = await r.json();
  document.getElementById('welcomeTitle').textContent = `👋 Welcome back, ${user.first_name || user.username}!`;
  document.getElementById('profileFirst').value = user.first_name || '';
  document.getElementById('profileLast').value = user.last_name || '';
  document.getElementById('profileEmail').value = user.email || '';
  document.getElementById('profilePhone').value = user.phone || '';
}

async function saveProfile() {
  const r = await apiRequest('/api/auth/profile/', 'PUT', {
    first_name: document.getElementById('profileFirst').value,
    last_name: document.getElementById('profileLast').value,
    email: document.getElementById('profileEmail').value,
    phone: document.getElementById('profilePhone').value,
  });
  if (r && r.ok) showToast('Profile saved!', 'success');
}

function handleRatingClick() {
  if (activeBookingId) openReviewModal(activeBookingId);
}

// ── Review Modal ───────────────────────────────────────────
function openReviewModal(bookingId) {
  activeBookingId = bookingId;
  selectedRating = 0;
  document.querySelectorAll('.star-btn').forEach(b => b.style.color = '#d1d5db');
  document.getElementById('reviewModal').classList.remove('hidden');
  document.getElementById('reviewModal').style.display = 'flex';
}

function closeReviewModal() {
  document.getElementById('reviewModal').classList.add('hidden');
  document.getElementById('reviewModal').style.display = 'none';
}

function selectStar(n) {
  selectedRating = parseInt(n, 10);
  document.querySelectorAll('.star-btn').forEach((b, i) => {
    b.style.color = i < selectedRating ? '#f59e0b' : '#d1d5db';
  });
}

async function submitReview() {
  if (!selectedRating) { showToast('Select a star rating', 'error'); return; }
  const comment = document.getElementById('reviewComment').value;
  const r = await apiRequest(`/api/bookings/${activeBookingId}/review/`, 'POST', {
    rating: selectedRating, comment
  });
  if (r && r.ok) {
    showToast('Review submitted! Thank you!', 'success');
    closeReviewModal();
    
    // Clear the active tracking and let it disappear from the Active Job page
    localStorage.removeItem('active_booking_id');
    localStorage.removeItem('active_booking_type');
    activeBookingId = null;
    
    updateBookingDisplay(null); 
    loadBookings();
    showSection('book');
  } else if (r) {
    const err = await r.json();
    showToast(err.error || 'Failed to submit review', 'error');
  }
}

// ── Payment Gateway ──────────────────────────────────────────
function openPaymentModal(booking) {
  activeBookingId = booking.id;
  document.querySelectorAll('.star-btn').forEach(b => b.style.color = '#d1d5db');
  
  const amt = parseFloat(booking.service_charge);
  const displayAmt = !isNaN(amt) && amt > 0 ? amt : Math.floor(Math.random() * 500) + 300;
  
  document.getElementById('paymentAmount').textContent = '₹' + displayAmt.toFixed(2);
  document.getElementById('paymentModal').classList.remove('hidden');
  document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
  document.getElementById('paymentModal').style.display = 'none';
}

function processPayment(method) {
  if (method === 'cash') {
    showToast('Processing Cash payment...', 'info');
    setTimeout(() => {
      localStorage.setItem('paid_' + activeBookingId, 'true');
      showToast('Payment confirmed! 🎉', 'success');
      closePaymentModal();
      loadBookings();
      openReviewModal(activeBookingId);
    }, 1500);
    return;
  }

  if (method === 'razorpay') {
    const amountText = document.getElementById('paymentAmount').textContent;
    const amountInPaise = Math.round(parseFloat(amountText.replace('₹','')) * 100);
    
    const options = {
      "key": "rzp_test_SVj69KGczT5g1s", 
      "amount": amountInPaise,
      "currency": "INR",
      "name": "Fix Ride",
      "description": "Service Booking Payment",
      "theme": { "color": "#2563eb" },
      "handler": function (response) {
        showToast('Payment Successful! ID: ' + response.razorpay_payment_id, 'success');
        localStorage.setItem('paid_' + activeBookingId, 'true');
        closePaymentModal();
        loadBookings();
        openReviewModal(activeBookingId);
      },
      "modal": {
        "ondismiss": function() {
          showToast('Payment Cancelled', 'error');
        }
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
  }
}
