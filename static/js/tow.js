/* ═══════════════════════════════════════════════════════════
   Fix_Ride - tow.js  (Live Location + Chat for Tow Operators)
   ═══════════════════════════════════════════════════════════ */

let towPollInterval = null;
let chatPollInterval = null;
let locationBroadcastInterval = null;
let activeJobId = null;
let isOnline = false;
let towMap = null;
let customerMarker = null;
let driverMarker = null;
let lastActiveJobState = null; 
let lastMessageCount = 0;
let justAcceptedId = null; 
let selectedChatBookingId = null;
function statusBadgeHtml(s) {
  const colors = { pending:'#f59e0b', accepted:'#3b82f6', en_route:'#6366f1', arrived:'#8b5cf6', in_progress:'#f97316', completed:'#22c55e', cancelled:'#ef4444', rejected:'#64748b' };
  return `<span style="background:${colors[s]||'#64748b'}20;color:${colors[s]||'#64748b'};padding:3px 10px;border-radius:99px;font-size:0.78rem;font-weight:700;">${(s||'').replace('_',' ').toUpperCase()}</span>`;
}


document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('access_token');
  const role  = localStorage.getItem('user_role');
  if (!token || role !== 'tow') { localStorage.clear(); window.location.href = '/auth/login/'; return; }
  await loadTowProfile();
  await loadTowBookings();
  startTowPolling();
  loadChatList();
});

// ── Show / hide sections ───────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  document.getElementById('nav-' + name).classList.add('active');
}

// ── Availability Toggle + Location Broadcast ───────────────
async function toggleAvailability() {
  const btn   = document.getElementById('availabilityBtn');
  const badge = document.getElementById('availabilityBadge');
  btn.disabled = true;
  btn.textContent = 'Updating...';

  const pos = await getPosition().catch(() => null);
  const body = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {};

  const r = await apiRequest('/api/mechanics/availability/', 'POST', body);
  if (r && r.ok) {
    const data = await r.json();
    isOnline = data.is_available;
    if (isOnline) {
      badge.textContent = 'Online'; badge.className = 'badge badge-online';
      btn.textContent = 'Go Offline'; btn.style.background = 'var(--danger)';
      showToast('You are now Online! Customers can now find you.', 'success');
      startLocationBroadcast();
    } else {
      badge.textContent = 'Offline'; badge.className = 'badge badge-offline';
      btn.textContent = 'Go Online'; btn.style.background = 'var(--success)';
      showToast('You are now Offline.', 'info');
      stopLocationBroadcast();
    }
  } else {
    showToast('Failed to update status.', 'error');
  }
  btn.disabled = false;
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('No geolocation'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
  });
}

function startLocationBroadcast() {
  if (locationBroadcastInterval) clearInterval(locationBroadcastInterval);
  locationBroadcastInterval = setInterval(broadcastLocation, 2500); // Near-instant tracking update
  broadcastLocation();
}

function stopLocationBroadcast() {
  if (locationBroadcastInterval) clearInterval(locationBroadcastInterval);
  locationBroadcastInterval = null;
}

async function broadcastLocation() {
  const pos = await getPosition().catch(() => null);
  if (!pos) return;
  await apiRequest('/api/mechanics/availability/', 'POST', {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    update_location_only: true
  });
}

// ── Load Bookings ──────────────────────────────────────────
async function loadTowBookings() {
  const r = await apiRequest('/api/bookings/my/');
  if (!r || !r.ok) return;
  const bookings = await r.json();

  const pending   = bookings.filter(b => b.status === 'pending');
  const active    = bookings.filter(b => ['accepted','en_route','arrived','in_progress'].includes(b.status));
  const completed = bookings.filter(b => b.status === 'completed');

  document.getElementById('statPending').textContent = pending.length;
  document.getElementById('statCompleted').textContent = completed.length;
  document.getElementById('statTotalJobs').textContent = bookings.length;
  const totalEarnings = completed.reduce((s, b) => s + parseFloat(b.service_charge || 0), 0);
  if (document.getElementById('statEarnings')) document.getElementById('statEarnings').textContent = '₹' + totalEarnings;
  if (document.getElementById('earningsTotal')) document.getElementById('earningsTotal').textContent = '₹' + totalEarnings;
  if (document.getElementById('earningsJobs')) document.getElementById('earningsJobs').textContent = completed.length;
  const avg = completed.length ? Math.round(totalEarnings / completed.length) : 0;
  if (document.getElementById('earningsAvg')) document.getElementById('earningsAvg').textContent = '₹' + avg;

  // Pending requests list
  const container = document.getElementById('requestsList');
  if (container) {
    container.innerHTML = pending.length
      ? pending.map(b => renderRequestCard(b)).join('')
      : '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No pending tow requests right now.</p>';
  }

  // Focus-safe active job rendering
  if (active.length) {
    const currentState = JSON.stringify({ id: active[0].id, status: active[0].status });
    if (currentState !== lastActiveJobState) {
      activeJobId = active[0].id;
      justAcceptedId = null; // Re-fetch found the job, clear immunity
      renderActiveJob(active[0]);
      lastActiveJobState = currentState;
    }
  } else if (activeJobId && justAcceptedId === activeJobId) {
    // Immunity: keep rendering the job we just accepted even if re-fetch is being slow/synchronous
    console.log('Immunity: Keeping active UI for job ' + activeJobId);
  } else {
    if (lastActiveJobState !== null || activeJobId !== null) { 
      activeJobId = null;
      lastActiveJobState = null;
      justAcceptedId = null;
      const content = document.getElementById('activeJobContent');
      if (content) {
        content.innerHTML = `<div class="card" style="text-align:center;padding:3rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">⚡</div>
          <p style="color:var(--text-muted);">No active job. Incoming requests will appear in the first tab.</p>
        </div>`;
      }
      const mapEl = document.getElementById('towMap');
      if (mapEl) mapEl.style.display = 'none';
      if (towMap) { towMap.remove(); towMap = null; }
    }
  }

  // History table
  const histBody = document.getElementById('historyBody');
  if (histBody) {
    histBody.innerHTML = bookings.length
      ? bookings.map(b => `<tr>
          <td>#${b.id}</td>
          <td>${b.customer?.username || '-'}</td>
          <td>${b.vehicle_type || '-'}</td>
          <td>${statusBadgeHtml(b.status)}</td>
          <td>₹${b.service_charge || 0}</td>
          <td>${new Date(b.created_at).toLocaleDateString('en-IN')}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">No history yet.</td></tr>';
  }
}

function renderRequestCard(b) {
  const serviceIcon = b.service_type === 'tow' ? '🚛' : '🔧';
  const displayAddr = (b.customer_address && b.customer_address.trim()) ? b.customer_address : '📍 Service Location';
  const distText = (b.distance_km !== null && b.distance_km !== undefined) ? `${b.distance_km} km away` : 'Distance unknown';

  return `<div class="card" style="border-left:4px solid var(--primary);">
    <div class="d-flex justify-between align-center mb-1">
      <div class="fw-bold">🚛 ${b.vehicle_type.toUpperCase()} · Booking #${b.id}</div>
    </div>
    <div style="color:var(--text-muted);font-size:0.875rem;margin-bottom:0.75rem;">📋 ${b.issue_description}</div>
    <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:0.5rem;">
      🏠 ${displayAddr}
    </div>
    <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:1rem;">
      🛤️ ${distText} · 👤 ${b.customer?.username || 'Customer'}
    </div>
    <div class="d-flex gap-1">
      <button class="btn btn-success btn-sm" onclick="acceptJob(${b.id})">✅ Accept</button>
      <button class="btn btn-danger btn-sm" onclick="rejectBooking(${b.id})">❌ Reject</button>
    </div>
  </div>`;
}
async function rejectBooking(id) {
  if (!id) return;
  if (!confirm('Reject this booking request?')) return;
  const r = await apiRequest(`/api/bookings/${id}/status/`, 'PUT', { status: 'rejected' });
  if (r && r.ok) {
    showToast('Booking rejected', 'info');
    if (id === activeJobId) {
      activeJobId = null;
      lastActiveJobState = null;
      document.getElementById('activeJobContent').innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;">No active job right now.</div>';
      const mapEl = document.getElementById('towMap');
      if (mapEl) mapEl.style.display = 'none';
      if (typeof towMap !== 'undefined' && towMap) { towMap.remove(); towMap = null; }
    }
    loadTowBookings();
  }
}

function statusBadgeHtml(s) {
  const colors = { pending:'#f59e0b', accepted:'#3b82f6', en_route:'#6366f1', arrived:'#8b5cf6', in_progress:'#f97316', completed:'#22c55e', cancelled:'#ef4444', rejected:'#64748b' };
  return `<span style="background:${colors[s]||'#64748b'}20;color:${colors[s]||'#64748b'};padding:3px 10px;border-radius:99px;font-size:0.78rem;font-weight:700;">${s.replace('_',' ').toUpperCase()}</span>`;
}

let lastBookingStatus = null;

function renderActiveJob(b) {
  const statusActions = {
    accepted: [{ label: '🚛 En Route', status: 'en_route' }],
    en_route: [{ label: '📍 Arrived', status: 'arrived' }],
    arrived:  [{ label: '🔧 Start Work', status: 'in_progress' }],
    in_progress: [{ label: '✅ Mark Completed', status: 'completed' }],
    completed: [],
  };
  const actions = statusActions[b.status] || [];
  const container = document.getElementById('activeJobContent');
  if (!container) return;

  const displayAddr = (b.customer_address && b.customer_address.trim()) ? b.customer_address : '📍 Service Location';

  container.innerHTML = `<div class="card">
    <div class="card-header">
      <div class="card-title">⚡ Active Job #${b.id}</div>
      <span class="badge badge-${b.status}">${b.status.replace('_',' ').toUpperCase()}</span>
    </div>
    <div class="grid-2" style="gap:1rem;margin-bottom:1rem;">
      <div>
        <div class="text-muted" style="font-size:0.8rem;">CUSTOMER</div>
        <div class="fw-bold">👤 ${b.customer?.username || '-'}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">${b.customer?.email || ''}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:0.8rem;">VEHICLE</div>
        <div class="fw-bold">🚗 ${(b.vehicle_type||'').toUpperCase()}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:0.8rem;">ISSUE</div>
        <div style="font-size:0.9rem;">${b.issue_description}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:0.8rem;">DISTANCE</div>
        <div class="text-primary fw-bold">📍 ${b.distance_km || '?'} km</div>
      </div>
    </div>
    <div style="background:var(--input-bg);border-radius:12px;padding:0.75rem;margin-bottom:1rem;font-size:0.85rem;color:var(--text-muted);">
      📍 ${displayAddr}
    </div>
    <div class="d-flex gap-1" style="flex-wrap:wrap;margin-bottom:1.5rem;">
      ${actions.map(a => `<button class="btn btn-primary btn-sm" onclick="updateJobStatus(${b.id},'${a.status}')">${a.label}</button>`).join('')}
      ${b.status !== 'completed' ? `<button class="btn btn-danger btn-sm" onclick="rejectBooking(${b.id})">❌ Abort Job</button>` : ''}
    </div>
    <div style="background:rgba(99,102,241,0.1); padding:1rem; border-radius:12px; border:1px dashed var(--info); text-align:center;">
      <p style="font-size:0.85rem; color:var(--text); margin-bottom:0.5rem;">Need to talk to the customer?</p>
      <button class="btn btn-primary btn-sm" onclick="showSection('chat'); selectChat(${b.id}, '${(b.customer?.username||'Customer').replace(/'/g, "\\'")}', '${b.status}')">🚛 Open Messenger</button>
  </div>`;

  // Show map AFTER DOM is written, then init Leaflet
  const mapEl = document.getElementById('towMap');
  if (!mapEl || !b.customer_lat || !b.customer_lng) return;
  mapEl.style.display = 'block';

  // Defer init so the browser has painted the block element
  setTimeout(() => {
    if (!towMap) {
      towMap = L.map('towMap').setView([b.customer_lat, b.customer_lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(towMap);
    } else {
      towMap.invalidateSize();
    }

    // Customer blue circle
    if (customerMarker) customerMarker.remove();
    customerMarker = L.circleMarker([b.customer_lat, b.customer_lng], {
      radius: 12, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.85, weight: 3
    }).addTo(towMap).bindPopup('🔵 Customer Location').openPopup();

    const driverLat = b.mechanic_lat;
    const driverLng = b.mechanic_lng;
    if (driverLat && driverLng) {
      if (driverMarker) driverMarker.remove();
      const icon = L.divIcon({
        html: '<div style="font-size:1.6rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))">🚛</div>',
        className: '', iconSize: [32, 32], iconAnchor: [16, 16]
      });
      driverMarker = L.marker([driverLat, driverLng], { icon }).addTo(towMap).bindPopup('📍 Your Location');
      towMap.fitBounds(
        L.latLngBounds([[b.customer_lat, b.customer_lng], [driverLat, driverLng]]),
        { padding: [50, 50] }
      );
    } else {
      towMap.setView([b.customer_lat, b.customer_lng], 15);
    }
  }, 100);
}

async function acceptJob(id) {
  const r = await apiRequest(`/api/bookings/${id}/accept/`, 'PUT');
  if (r && r.ok) {
    const data = await r.json();
    showToast('Job accepted! Routing you now...', 'success');
    activeJobId = id;
    justAcceptedId = id; // Flag for immunity
    lastActiveJobState = JSON.stringify({ id: data.booking.id, status: data.booking.status });
    renderActiveJob(data.booking);
    await loadTowBookings(); 
    showSection('active');
  } else if (r) {
    const e = await r.json();
    showToast(e.error || 'Failed', 'error');
  }
}

async function rejectJob(id) {
  const r = await apiRequest(`/api/bookings/${id}/reject/`, 'PUT');
  if (r && r.ok) { showToast('Declined.', 'info'); loadTowBookings(); }
}

async function updateJobStatus(id, newStatus) {
  const r = await apiRequest(`/api/bookings/${id}/status/`, 'PUT', { status: newStatus });
  if (r && r.ok) {
    const data = await r.json();
    showToast(`Status: ${newStatus.replace('_',' ')}`, 'success');
    if (newStatus === 'completed') { activeJobId = null; lastActiveJobState = null; loadTowBookings(); }
    else {
      lastActiveJobState = JSON.stringify({ id: data.booking.id, status: data.booking.status });
      renderActiveJob(data.booking);
    }
  }
}

function stopTowPolling() {
  if (towPollInterval) clearInterval(towPollInterval);
  towPollInterval = null;
  if (locationBroadcastInterval) clearInterval(locationBroadcastInterval);
  locationBroadcastInterval = null;
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = null;
}

function startTowPolling() {
  if (towPollInterval) clearInterval(towPollInterval);
  towPollInterval = setInterval(() => loadTowBookings(), 4000); // Faster sync
}


// ── Universal Messenger ─────────────────────────────────────
function startChatPolling() {
  stopChatPolling();
  chatPollInterval = setInterval(loadMessages, 1500);
}

function stopChatPolling() {
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = null;
}

async function loadChatList() {
  const r = await apiRequest('/api/bookings/my/');
  if (!r || !r.ok) return;
  const bookings = await r.json();
  const listEl = document.getElementById('chatList');
  if (!listEl) return;
  
  if (!bookings.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">No conversations yet.</div>';
    return;
  }
  
  // Group by Customer ID
  const uniqueCustomers = {};
  bookings.forEach(b => {
    const cId = b.customer.id;
    if (!uniqueCustomers[cId] || new Date(b.created_at) > new Date(uniqueCustomers[cId].created_at)) {
      uniqueCustomers[cId] = b;
    }
  });

  const chatItems = Object.values(uniqueCustomers).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  listEl.innerHTML = chatItems.map(b => {
    const cName = b.customer.first_name || b.customer.username || 'Customer';
    const isActive = selectedChatBookingId === b.id ? 'background:var(--input-bg);border-left:4px solid var(--primary);' : 'border-left:4px solid transparent;';
    
    return `<div style="padding:1rem; cursor:pointer; border-bottom:1px solid var(--border); transition:all 0.2s; ${isActive}" 
                 onclick="selectChat(${b.id}, '${cName.replace(/'/g, "\\'")}', '${b.status}')">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
        <span style="font-weight:700;">👤 ${cName}</span>
        ${statusBadgeHtml(b.status)}
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);">
         Booking #${b.id} · ${b.vehicle_type.toUpperCase()}
      </div>
    </div>`;
  }).join('');
}

function selectChat(id, cname, status) {
  selectedChatBookingId = id;
  lastMessageCount = 0;
  document.getElementById('chatActiveHeader').textContent = cname;
  document.getElementById('chatActiveStatus').innerHTML = `Booking #${id} · Status: ${statusBadgeHtml(status)}`;
  
  const inp = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  inp.disabled = false;
  btn.disabled = false;
  
  loadChatList();
  
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

  if (messages.length === lastMessageCount && container.innerHTML.trim() !== '' && !container.innerHTML.includes('Loading messages')) return;
  lastMessageCount = messages.length;

  const myUsername = localStorage.getItem('user_name');
  const atBottom = (container.scrollHeight - container.clientHeight) <= (container.scrollTop + 20);

  if (!messages.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;height:100%;display:flex;align-items:center;justify-content:center;">No messages here. 👋</div>';
    return;
  }
  
  container.innerHTML = messages.map(m => {
    const isMine = m.sender_username === myUsername;
    return `<div class="chat-bubble ${isMine ? 'sent' : 'received'}">
      ${m.content}
      <div class="meta">${m.sender_username} · ${new Date(m.timestamp).toLocaleTimeString()}</div>
    </div>`;
  }).join('');
  
  if (atBottom || lastMessageCount === messages.length) {
    container.scrollTop = container.scrollHeight;
  }
}

async function sendMessage() {
  if (!selectedChatBookingId) return;
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

// ── Profile ───────────────────────────────────────────────
async function loadTowProfile() {
  const r = await apiRequest('/api/auth/me/');
  if (!r || !r.ok) { localStorage.clear(); window.location.href = '/auth/login/'; return; }
  const u = await r.json();
  document.getElementById('towWelcome').textContent  = '👋 Welcome, ' + (u.first_name || u.username) + '!';
  document.getElementById('towSubtitle').textContent = 'Tow Operator · ' + u.email;
  ['profName','profUsername','profEmail','profPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'profName') el.value = ((u.first_name || '') + ' ' + (u.last_name || '')).trim();
    if (id === 'profUsername') el.value = u.username;
    if (id === 'profEmail') el.value = u.email;
    if (id === 'profPhone') el.value = u.phone || '—';
  });
  localStorage.setItem('user_name', u.username);

  // Sync online/offline badge from server profile
  try {
    const pr = await apiRequest('/api/mechanics/profile/');
    if (pr && pr.ok) {
      const profile = await pr.json();
      isOnline = profile.is_available || false;
      const badge = document.getElementById('availabilityBadge');
      const btn   = document.getElementById('availabilityBtn');
      if (isOnline) {
        if (badge) { badge.textContent = 'Online'; badge.className = 'badge badge-online'; }
        if (btn)   { btn.textContent = 'Go Offline'; btn.style.background = 'var(--danger)'; }
        startLocationBroadcast();
      }
    }
  } catch(e) { /* profile may not exist yet for new tow operators */ }
}

function startTowPolling() {
  if (towPollInterval) clearInterval(towPollInterval);
  towPollInterval = setInterval(() => loadTowBookings(), 8000);
}
