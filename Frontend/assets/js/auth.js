let currentRole = 'customer';

function setLoginRole(role) {
    currentRole = role;
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--color-text-muted)';
        btn.style.boxShadow = 'none';
    });
    const activeBtn = document.querySelector(`.role-btn[data-role="${role}"]`);

    if (role === 'mechanic') {
        activeBtn.style.background = 'var(--color-secondary)';
        activeBtn.style.color = 'black';
        activeBtn.style.boxShadow = 'var(--shadow-glow-secondary)';
    } else if (role === 'tow') {
        activeBtn.style.background = 'var(--color-warning)';
        activeBtn.style.color = 'black';
    } else {
        activeBtn.style.background = 'var(--color-primary)';
        activeBtn.style.color = 'white';
        activeBtn.style.boxShadow = 'var(--shadow-glow-primary)';
    }
}

function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.innerHTML = 'Verifying...';

    // Store selected role
    localStorage.setItem('userRole', currentRole);

    setTimeout(() => {
        if (currentRole === 'customer') window.location.href = 'emergency.html';
        else if (currentRole === 'mechanic') window.location.href = 'dashboard-mechanic.html';
        else if (currentRole === 'tow') window.location.href = 'dashboard-tow.html';
        else window.location.href = 'admin.html';
    }, 1000);
}
