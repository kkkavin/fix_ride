/* ═══════════════════════════════════════════════════════════
   Fix_Ride - admin.js
   Admin Dashboard Logic
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(['admin'])) return;
  await loadAdminDashboard();
  loadAdminMechanics();
  loadAdminUsers();
  loadAdminBookings();
});

// ── Dashboard Stats ────────────────────────────────────────
async function loadAdminDashboard() {
  const r = await apiRequest('/api/bookings/admin/dashboard/');
  if (!r || !r.ok) {
    showToast('Could not load dashboard data', 'error');
    return;
  }
  const data = await r.json();
  const s = data.stats;
  document.getElementById('sTotalUsers').textContent = s.total_users;
  document.getElementById('sTotalBookings').textContent = s.total_bookings;
  document.getElementById('sCompleted').textContent = s.completed_bookings;
  document.getElementById('sRevenue').textContent = '₹' + s.total_revenue.toFixed(0);
  document.getElementById('sActive').textContent = s.active_bookings;
  document.getElementById('sPending').textContent = s.pending_mechanic_approval;

  // Recent bookings table
  const tbody = document.getElementById('recentBookingsBody');
  if (!tbody) return;
  if (!data.recent_bookings.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1rem;">No bookings yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.recent_bookings.map(b => `<tr>
    <td>#${b.id}</td>
    <td>${b.customer?.username || '-'}</td>
    <td>${b.mechanic?.user?.username || 'Unassigned'}</td>
    <td>${b.vehicle_type}</td>
    <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.issue_description}</td>
    <td>${statusBadge(b.status)}</td>
    <td>${formatDate(b.created_at)}</td>
  </tr>`).join('');
}

// ── All Bookings ───────────────────────────────────────────
async function loadAdminBookings() {
  const r = await apiRequest('/api/bookings/my/');
  if (!r || !r.ok) return;
  const bookings = await r.json();
  const tbody = document.getElementById('adminBookingsBody');
  if (!tbody) return;
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1rem;">No bookings.</td></tr>';
    return;
  }
  tbody.innerHTML = bookings.map(b => `<tr>
    <td>#${b.id}</td>
    <td>${b.customer?.username || '-'}</td>
    <td>${b.mechanic?.user?.username || 'Unassigned'}</td>
    <td>${b.vehicle_type}</td>
    <td>${statusBadge(b.status)}</td>
    <td>${b.distance_km ? b.distance_km + ' km' : '-'}</td>
    <td>${formatDate(b.created_at)}</td>
  </tr>`).join('');
}

// ── Mechanics ──────────────────────────────────────────────
async function loadAdminMechanics() {
  const r = await apiRequest('/api/bookings/admin/mechanics/');
  if (!r || !r.ok) return;
  const mechanics = await r.json();
  const tbody = document.getElementById('mechanicsBody');
  if (!tbody) return;
  if (!mechanics.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:1rem;">No mechanics registered.</td></tr>';
    return;
  }
  tbody.innerHTML = mechanics.map(m => `<tr>
    <td>
      <div class="fw-bold">${m.user?.username || '-'}</div>
      <div style="font-size:0.78rem;color:var(--text-muted);">${m.user?.email || ''}</div>
    </td>
    <td>${m.skills || '-'}</td>
    <td>${m.experience_years} yr</td>
    <td>${m.is_available ? '<span class="badge badge-online">Online</span>' : '<span class="badge badge-offline">Offline</span>'}</td>
    <td>${m.is_approved ? '<span class="badge badge-completed">Granted</span>' : '<span class="badge badge-pending">Pending</span>'}</td>
    <td>${m.total_jobs}</td>
    <td>₹${m.total_earnings}</td>
    <td>
      ${!m.is_approved
        ? `<button class="btn btn-success btn-sm" onclick="approveMechanic(${m.id},'approve')">✅ Grant</button>`
        : `<button class="btn btn-danger btn-sm" onclick="approveMechanic(${m.id},'reject')">❌ Revoke</button>`
      }
    </td>
  </tr>`).join('');
}

async function approveMechanic(id, action) {
  const r = await apiRequest(`/api/bookings/admin/mechanics/${id}/approve/`, 'PUT', { action });
  if (r && r.ok) {
    const data = await r.json();
    showToast(data.message, 'success');
    loadAdminMechanics();
    loadAdminDashboard();
  } else if (r) {
    const err = await r.json();
    showToast(err.error || 'Failed', 'error');
  }
}

// ── Users ──────────────────────────────────────────────────
async function loadAdminUsers() {
  const r = await apiRequest('/api/bookings/admin/users/');
  if (!r || !r.ok) return;
  const users = await r.json();
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1rem;">No users.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `<tr>
    <td>#${u.id}</td>
    <td class="fw-bold">${u.username}</td>
    <td>${u.email || '-'}</td>
    <td><span class="badge badge-${u.role === 'customer' ? 'accepted' : u.role === 'mechanic' ? 'in_progress' : 'completed'}">${u.role}</span></td>
    <td>${u.phone || '-'}</td>
    <td>${formatDate(u.created_at)}</td>
    <td>
      <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${u.username}')">🗑️</button>
    </td>
  </tr>`).join('');
}

async function deleteUser(id, username) {
  if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
  const r = await apiRequest(`/api/bookings/admin/users/${id}/delete/`, 'DELETE');
  if (r && r.ok) {
    showToast(`User ${username} deleted.`, 'info');
    loadAdminUsers();
    loadAdminDashboard();
  }
}
