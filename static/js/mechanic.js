/* ═══════════════════════════════════════════════════════════
   Fix_Ride - mechanic.js  (v3.0 - Live Location + Seamless Chat)
   ═══════════════════════════════════════════════════════════ */

let mechPollInterval = null;
let chatPollInterval = null;
let locationBroadcastInterval = null;
let activeJobId = null;
let mechMap = null;
let customerMarker = null;
let providerMarker = null;
let lastActiveJobState = null;
let lastMessageCount = 0;
let justAcceptedId = null; 
let selectedChatBookingId = null;


document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(['mechanic'])) return;
  await loadMechProfile();
  await loadMechBookings();
  startMechPolling();
  loadChatList();
});

// ── Availability Toggle (with live location broadcast) ─────
async function toggleAvailability() {
  const btn = document.getElementById('availabilityBtn');
  btn.disabled = true;
  btn.textContent = 'Updating...';

  const pos = await getPosition().catch(() => null);
  const body = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {};

  const r = await apiRequest('/api/mechanics/availability/', 'POST', body);
  if (r && r.ok) {
    const data = await r.json();
    const badge = document.getElementById('availabilityBadge');
    if (data.is_available) {
      badge.className = 'badge badge-online'; badge.textContent = 'Online';
      btn.textContent = 'Go Offline'; btn.style.background = 'var(--danger)';
      showToast('You are now Online! Sending live location.', 'success');
      startLocationBroadcast();
    } else {
      badge.className = 'badge badge-offline'; badge.textContent = 'Offline';
      btn.textContent = 'Go Online'; btn.style.background = 'var(--success)';
      showToast('You are now Offline.', 'info');
      stopLocationBroadcast();
    }
  }
  btn.disabled = false;
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('No geolocation'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
  });
}

// ── Live Location Broadcasting ─────────────────────────────
function startLocationBroadcast() {
  if (locationBroadcastInterval) clearInterval(locationBroadcastInterval);
  locationBroadcastInterval = setInterval(broadcastLocation, 2500); // Near-instant tracking update
  broadcastLocation(); // immediate first broadcast
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


async function loadMechBookings() {
  const r = await apiRequest('/api/bookings/my/');
  if (!r || !r.ok) return;
  const bookings = await r.json();

  const pending   = bookings.filter(b => b.status === 'pending');
  const active    = bookings.filter(b => ['accepted','en_route','arrived','in_progress'].includes(b.status));
  const completed = bookings.filter(b => ['completed','cancelled'].includes(b.status));

  document.getElementById('statPending').textContent = pending.length;
  document.getElementById('statCompleted').textContent = completed.filter(b => b.status === 'completed').length;
  document.getElementById('statTotalJobs').textContent = bookings.length;

  const requestsList = document.getElementById('requestsList');
  if (requestsList) {
    requestsList.innerHTML = pending.length
      ? pending.map(b => renderRequestCard(b)).join('')
      : '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No pending requests right now.</p>';
  }

  // Focus-safe active job rendering
  if (active.length) {
    const currentState = JSON.stringify({ id: active[0].id, status: active[0].status });
    if (currentState !== lastActiveJobState) {
      activeJobId = active[0].id;
      justAcceptedId = null;
      renderActiveJob(active[0]);
      lastActiveJobState = currentState;
    }
  } else if (activeJobId && justAcceptedId === activeJobId) {
    // Immunity
  } else {
    if (lastActiveJobState !== null || activeJobId !== null) {
      activeJobId = null;
      lastActiveJobState = null;
      justAcceptedId = null;
      const content = document.getElementById('activeJobContent');
      if (content) content.innerHTML = `<div class="card" style="text-align:center;padding:3rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">⚡</div>
        <p style="color:var(--text-muted);">No active job. New bookings will appear in the requests tab.</p>
      </div>`;
      const mapEl = document.getElementById('mechMap');
      if (mapEl) mapEl.style.display = 'none';
      if (mechMap) { mechMap.remove(); mechMap = null; }
    }
  }

  const histBody = document.getElementById('historyBody');
  if (histBody) {
    histBody.innerHTML = bookings.length
      ? bookings.map(b => `<tr>
          <td>#${b.id}</td>
          <td>${b.customer?.username || '-'}</td>
          <td>${b.vehicle_type}</td>
          <td>${statusBadge(b.status)}</td>
          <td>${b.distance_km ? b.distance_km + ' km' : '-'}</td>
          <td>₹${b.service_charge || 0}</td>
          <td>${formatDate(b.created_at)}</td>
        </tr>`).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">No jobs yet.</td></tr>';
  }

  // Earnings
  const done = bookings.filter(b => b.status === 'completed');
  const totalEarnings = done.reduce((s, b) => s + parseFloat(b.service_charge || 0), 0);
  const avg = done.length ? Math.round(totalEarnings / done.length) : 0;
  ['earningsTotal','earningsTotal'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '₹' + totalEarnings; });
  document.getElementById('earningsTotal') && (document.getElementById('earningsTotal').textContent = '₹' + totalEarnings);
  document.getElementById('earningsJobs') && (document.getElementById('earningsJobs').textContent = done.length);
  document.getElementById('earningsAvg') && (document.getElementById('earningsAvg').textContent = '₹' + avg);
  document.getElementById('statEarnings') && (document.getElementById('statEarnings').textContent = '₹' + totalEarnings);
}

function renderRequestCard(b) {
  const serviceIcon = b.service_type === 'tow' ? '🚛' : '🔧';
  const displayAddr = (b.customer_address && b.customer_address.trim()) ? b.customer_address : '📍 Service Location';
  const distText = (b.distance_km !== null && b.distance_km !== undefined) ? `${b.distance_km} km away` : 'Distance unknown';

  return `<div class="card" style="border-left:4px solid var(--primary);">
    <div class="d-flex justify-between align-center mb-1">
      <div class="fw-bold">${serviceIcon} ${b.vehicle_type.toUpperCase()} · Booking #${b.id}</div>
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
      const mapEl = document.getElementById('mechMap');
      if (mapEl) mapEl.style.display = 'none';
      if (typeof mechMap !== 'undefined' && mechMap) { mechMap.remove(); mechMap = null; }
    }
    loadMechBookings();
  }
}

function renderActiveJob(b) {
  const content = document.getElementById('activeJobContent');
  if (!content) return;

  const displayAddr = (b.customer_address && b.customer_address.trim()) ? b.customer_address : '📍 Service Location';

  const statusActions = {
    accepted: [{ label: '🚗 En Route', status: 'en_route' }],
    en_route: [{ label: '📍 Arrived', status: 'arrived' }],
    arrived: [{ label: '🔧 Start Work', status: 'in_progress' }],
    in_progress: [{ label: '✅ Mark Completed', status: 'completed' }],
    completed: [],
  };
  const actions = statusActions[b.status] || [];

  content.innerHTML = `<div class="card">
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
        <div class="fw-bold">🚗 ${b.vehicle_type.toUpperCase()}</div>
      </div>
      <div>
        <div class="text-muted" style="font-size:0.8rem;">ISSUE</div>
        <div>${b.issue_description}</div>
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
    <div style="background:rgba(249,115,22,0.1); padding:1rem; border-radius:12px; border:1px dashed var(--primary); text-align:center;">
      <p style="font-size:0.85rem; color:var(--text); margin-bottom:0.5rem;">Need to talk to the customer?</p>
      <button class="btn btn-primary btn-sm" onclick="showSection('chat'); selectChat(${b.id}, '${(b.customer?.username||'Customer').replace(/'/g, "\\'")}', '${b.status}')">💬 Open Messenger</button>
    </div>
  </div>`;

  const mapEl = document.getElementById('mechMap');
  if (!mapEl || !b.customer_lat || !b.customer_lng) return;
  mapEl.style.display = 'block';

  setTimeout(() => {
    if (!mechMap) {
      mechMap = L.map('mechMap').setView([b.customer_lat, b.customer_lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mechMap);
    } else {
      mechMap.invalidateSize();
    }
    
    // Update markers
    if (customerMarker) customerMarker.remove();
    customerMarker = L.circleMarker([b.customer_lat, b.customer_lng], {
      radius: 12, color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.85, weight: 3
    }).addTo(mechMap).bindPopup('🔵 Customer Location').openPopup();

    const providerLat = b.mechanic_lat;
    const providerLng = b.mechanic_lng;
    if (providerLat && providerLng) {
      if (providerMarker) providerMarker.remove();
      const icon = L.divIcon({ html: '<div style="font-size:1.6rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🔧</div>', className: '', iconSize: [32, 32], iconAnchor: [16, 16] });
      providerMarker = L.marker([providerLat, providerLng], { icon }).addTo(mechMap).bindPopup('📍 Your Location');
      
      const bounds = L.latLngBounds([[b.customer_lat, b.customer_lng], [providerLat, providerLng]]);
      mechMap.fitBounds(bounds, { padding: [50, 50] });
    } else {
      mechMap.setView([b.customer_lat, b.customer_lng], 15);
    }
  }, 100);
}

// ── Accept / Reject ────────────────────────────────────────
async function acceptJob(id) {
  const r = await apiRequest(`/api/bookings/${id}/accept/`, 'PUT');
  if (r && r.ok) {
    const data = await r.json();
    showToast('Job accepted! Routing you now...', 'success');
    activeJobId = id;
    justAcceptedId = id;
    lastActiveJobState = JSON.stringify({ id: data.booking.id, status: data.booking.status });
    renderActiveJob(data.booking);
    await loadMechBookings();
    showSection('active');
  } else if (r) {
    const err = await r.json();
    showToast(err.error || 'Failed', 'error');
  }
}

async function rejectBooking(id) {
  const r = await apiRequest(`/api/bookings/${id}/reject/`, 'PUT');
  if (r && r.ok) {
    showToast('Booking rejected.', 'info');
    loadMechBookings();
  }
}

async function updateJobStatus(id, newStatus) {
  const r = await apiRequest(`/api/bookings/${id}/status/`, 'PUT', { status: newStatus });
  if (r && r.ok) {
    const data = await r.json();
    showToast(`Status: ${newStatus.replace('_',' ')}`, 'success');
    if (newStatus === 'completed') {
      activeJobId = null;
      lastActiveJobState = null;
      loadMechBookings();
      loadMechProfile();
    } else {
      lastActiveJobState = JSON.stringify({ id: data.booking.id, status: data.booking.status });
      renderActiveJob(data.booking);
    }
  }
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
    listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);">No active chats yet.</div>';
    return;
  }
  
  // Group by Customer ID to prevent individual booking duplicates
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
        <span class="badge badge-${b.status}" style="font-size:0.7rem;">${b.status.replace('_',' ')}</span>
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
  document.getElementById('chatActiveStatus').innerHTML = `Booking #${id} · Status: ${status.replace('_',' ')}`;
  
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
    container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:2rem;height:100%;display:flex;align-items:center;justify-content:center;">No messages yet.</div>';
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

function stopMechPolling() {
  if (mechPollInterval) clearInterval(mechPollInterval);
  mechPollInterval = null;
  if (locationBroadcastInterval) clearInterval(locationBroadcastInterval);
  locationBroadcastInterval = null;
  if (chatPollInterval) clearInterval(chatPollInterval);
  chatPollInterval = null;
}

function startMechPolling() {
  if (mechPollInterval) clearInterval(mechPollInterval);
  mechPollInterval = setInterval(() => loadMechBookings(), 4000); // Faster background sync
}




// ── Profile ─────────────────────────────────────────────────
async function loadMechProfile() {
  const r = await apiRequest('/api/mechanics/profile/');
  if (!r || !r.ok) return;
  const profile = await r.json();
  document.getElementById('mechWelcome').textContent = `👋 Welcome, ${profile.user?.first_name || profile.user?.username || 'Mechanic'}!`;
  document.getElementById('statTotalJobs').textContent = profile.total_jobs || 0;
  document.getElementById('statEarnings').textContent = '₹' + (profile.total_earnings || 0);
  document.getElementById('earningsTotal').textContent = '₹' + (profile.total_earnings || 0);
  document.getElementById('earningsJobs').textContent = profile.total_jobs || 0;
  const avg = profile.total_jobs ? Math.round(profile.total_earnings / profile.total_jobs) : 0;
  document.getElementById('earningsAvg').textContent = '₹' + avg;
  document.getElementById('mpSkills').value = profile.skills || '';
  document.getElementById('mpExperience').value = profile.experience_years || 0;
  document.getElementById('mpRadius').value = profile.service_radius_km || 15;
  document.getElementById('mpBio').value = profile.bio || '';
  const subtitle = document.getElementById('mechSubtitle');
  if (subtitle) subtitle.textContent = profile.skills;
  if (!profile.is_approved) document.getElementById('approvalAlert')?.classList.remove('hidden');

  const badge = document.getElementById('availabilityBadge');
  const btn   = document.getElementById('availabilityBtn');
  if (profile.is_available) {
    if (badge) { badge.className = 'badge badge-online'; badge.textContent = 'Online'; }
    if (btn) { btn.textContent = 'Go Offline'; btn.style.background = 'var(--danger)'; }
    startLocationBroadcast(); // Resume loop if already online
  }
}

async function saveMechProfile() {
  const r = await apiRequest('/api/mechanics/profile/', 'PUT', {
    skills: document.getElementById('mpSkills').value,
    experience_years: document.getElementById('mpExperience').value,
    service_radius_km: document.getElementById('mpRadius').value,
    bio: document.getElementById('mpBio').value,
  });
  if (r && r.ok) showToast('Profile saved!', 'success');
}

