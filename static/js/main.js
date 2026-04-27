/* ═══════════════════════════════════════════════════════════
   Fix_Ride - main.js
   Global utilities: theme, auth, toast, chatbot, section nav
   ═══════════════════════════════════════════════════════════ */

// ── Theme Management ────────────────────────────────────────
(function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  
  window.addEventListener('DOMContentLoaded', () => {
    const iconSpan = document.querySelector('.theme-icon');
    if (iconSpan) iconSpan.textContent = saved === 'light' ? '☀️' : '🌙';
  });
})();

document.getElementById('themeToggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  
  const iconSpan = document.querySelector('.theme-icon');
  if (iconSpan) iconSpan.textContent = next === 'light' ? '☀️' : '🌙';
});

// ── Auth State ──────────────────────────────────────────────
function getToken() { return localStorage.getItem('access_token'); }
function getUserRole() { return localStorage.getItem('user_role'); }

function logout() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user_name');
  window.location.href = '/auth/login/';
}

// Update navbar based on auth state
(function updateNavbar() {
  const token = getToken();
  const role = getUserRole();
  const name = localStorage.getItem('user_name') || '';
  const authBtns = document.getElementById('navAuthButtons');
  const userMenu = document.getElementById('navUserMenu');
  const navUsername = document.getElementById('navUsername');
  const dashLink = document.getElementById('navDashboardLink');

  if (token) {
    if (authBtns) authBtns.classList.add('hidden');
    if (userMenu) userMenu.classList.remove('hidden');
    if (navUsername) navUsername.textContent = name;
    const urls = { customer: '/customer/dashboard/', mechanic: '/mechanic/dashboard/', admin: '/admin-panel/', tow: '/tow/dashboard/' };
    const targetUrl = urls[role] || '/customer/dashboard/';
    if (dashLink) {
      dashLink.href = targetUrl;
    }
    const logoLink = document.querySelector('.nav-logo');
    if (logoLink) {
      logoLink.href = targetUrl;
    }
    
    // Explicitly hide landing page links if logged in
    document.querySelectorAll('#navLinks li').forEach(li => {
      const link = li.querySelector('a');
      const href = link ? link.getAttribute('href') : '';
      if (link && (href === '/' || href.startsWith('#') || href.startsWith('/#'))) {
        li.style.display = 'none';
      }
    });
  }
})();

// ── API Helper ──────────────────────────────────────────────
async function apiRequest(url, method = 'GET', body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
  }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    if (r.status === 401) {
      // Try token refresh
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        const rr = await fetch('/api/auth/token/refresh/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh })
        });
        if (rr.ok) {
          const d = await rr.json();
          localStorage.setItem('access_token', d.access);
          headers['Authorization'] = 'Bearer ' + d.access;
          const r2 = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
          return r2;
        }
      }
      logout();
      return null;
    }
    return r;
  } catch (err) {
    showToast('Network error. Check your connection.', 'error');
    return null;
  }
}

// ── Toast Notifications ─────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Section Navigation (dashboards) ────────────────────────
function showSection(name) {
  document.querySelectorAll('.section-panel').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const panel = document.getElementById('section-' + name);
  if (panel) panel.classList.add('active');
  const btn = document.getElementById('nav-' + name);
  if (btn) btn.classList.add('active');
  
  // Fix for partial map loading
  setTimeout(() => {
    if (typeof map !== 'undefined' && map) map.invalidateSize();
    if (typeof statusMap !== 'undefined' && statusMap) statusMap.invalidateSize();
    if (typeof mechMap !== 'undefined' && mechMap) mechMap.invalidateSize();
    if (typeof towMap !== 'undefined' && towMap) towMap.invalidateSize();
  }, 100);
}

// ── Chatbot Widget ──────────────────────────────────────────
document.getElementById('chatbotToggle')?.addEventListener('click', () => {
  document.getElementById('chatbotWindow').classList.toggle('open');
});

async function sendChatbotMsg() {
  const input = document.getElementById('chatbotInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendChatbotMsg(msg, 'sent');
  try {
    const r = await fetch('/api/chatbot/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await r.json();
    appendChatbotMsg(data.reply || 'Sorry, try again.', 'received');
  } catch {
    appendChatbotMsg('Could not reach assistant. Try again.', 'received');
  }
}

function appendChatbotMsg(text, type) {
  const container = document.getElementById('chatbotMessages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'chat-bubble ' + type;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ── Responsive Interaction ─────────────────────────────────
// ── Responsive Interaction ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const navLinks = document.getElementById('navLinks');
  const isDashboard = !!document.querySelector('.dashboard-wrapper');

  if (mobileMenuToggle) {
    mobileMenuToggle.onclick = () => {
      if (isDashboard) {
        toggleSidebar();
      } else if (navLinks) {
        navLinks.classList.toggle('mobile-open');
      }
    }
  }

  // Hide landing page links on Dashboard
  if (isDashboard) {
    document.querySelectorAll('#navLinks li').forEach(li => {
      const link = li.querySelector('a');
      const href = link ? link.getAttribute('href') : '';
      if (link && (href.startsWith('#') || href.startsWith('/#'))) {
        li.style.display = 'none';
      }
    });
  }

  // Reposition or hide chatbot on mobile to avoid SOS overlap
  const chatbotBtn = document.getElementById('chatbotToggle');
  const isHomePage = window.location.pathname === '/' || window.location.pathname === '/index.html';
  
  if (chatbotBtn && window.innerWidth <= 768) {
    if (isHomePage) {
      chatbotBtn.style.display = 'none';
    } else {
      chatbotBtn.style.bottom = '20px';
      chatbotBtn.style.right = '20px';
      chatbotBtn.style.width = '48px';
      chatbotBtn.style.height = '48px';
    }
  }
});

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('open');
    overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
  }
}

window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 768;
  const navLinks = document.getElementById('navLinks');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!isMobile) {
    if (navLinks) navLinks.classList.remove('mobile-open');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }
});

// ── Utility functions ───────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusBadge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

// Auth guard for protected pages
function requireAuth(allowedRoles = []) {
  const token = getToken();
  if (!token) { window.location.href = '/auth/login/'; return false; }
  const role = getUserRole();
  if (allowedRoles.length && !allowedRoles.includes(role)) {
    window.location.href = '/auth/login/';
    return false;
  }
  return true;
}
