// ======================
// CONFIG – keep your real Supabase values here
// ======================
const SUPABASE_URL = 'MOVING';
const SUPABASE_ANON_KEY = 'MOVING';

const headers = (token = SUPABASE_ANON_KEY) => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`
});

let currentSession = null;
let currentProfile = null;
let turnstileToken = null;
let authMode = 'signin'; // signin | signup

window.onTurnstileSuccess = function (token) {
  turnstileToken = token;
};

// ======================
// Mobile menu
// ======================
const menuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');
if (menuBtn && navLinks) {
  menuBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a,button').forEach((el) => {
    el.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// ======================
// Waitlist
// ======================
const form = document.getElementById('waitlistForm');
const successMessage = document.getElementById('successMessage');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('input[name="email"]').value.trim().toLowerCase();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!email) return;
    if (!document.getElementById('waitlistTos')?.checked) {
      alert('Please agree to the Terms of Service and Privacy Policy to join the waitlist.');
      return;
    }
    if (!turnstileToken) {
      alert('Please complete the security check first.');
      return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Joining...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'return=minimal' },
        body: JSON.stringify({ email })
      });

      if (response.ok || response.status === 201 || response.status === 409) {
        form.hidden = true;
        successMessage.hidden = false;
        if (response.status === 409) {
          successMessage.querySelector('h3').textContent = "You're already on the list!";
        }
      } else {
        alert('Something went wrong. Please try again.');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        window.turnstile && window.turnstile.reset();
        turnstileToken = null;
      }
    } catch (err) {
      console.error(err);
      alert('Network error. Please try again.');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ======================
// Auth UI
// ======================
const authModal = document.getElementById('authModal');
const accountBtn = document.getElementById('accountBtn');
const staffNavLink = document.getElementById('staffNavLink');
const staffSection = document.getElementById('staff');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSub = document.getElementById('authSub');
const authNote = document.getElementById('authNote');
const authSubmit = document.getElementById('authSubmit');
const authGuest = document.getElementById('authGuest');
const authSignedIn = document.getElementById('authSignedIn');

accountBtn?.addEventListener('click', () => {
  if (authModal) authModal.hidden = false;
});
document.getElementById('authClose')?.addEventListener('click', () => {
  if (authModal) authModal.hidden = true;
});
authModal?.addEventListener('click', (e) => {
  if (e.target === authModal) authModal.hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && authModal && !authModal.hidden) authModal.hidden = true;
});

document.querySelectorAll('.auth-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    setAuthMode(tab.dataset.mode);
  });
});

function setAuthMode(mode) {
  authMode = mode;
  if (authTitle) authTitle.textContent = mode === 'signin' ? 'Welcome back' : 'Create your account';
  if (authSub) authSub.textContent = mode === 'signin'
    ? 'Sign in with your email or username.'
    : 'Pick a username. Passwords stay private.';
  if (authSubmit) authSubmit.textContent = mode === 'signin' ? 'Sign In' : 'Create account';
  const usernameField = document.getElementById('usernameField');
  const loginIdField = document.getElementById('loginIdField');
  if (usernameField) usernameField.hidden = mode !== 'signup';
  const tosField = document.getElementById('signupTosField');
  if (tosField) {
    tosField.hidden = mode !== 'signup';
    const tosBox = document.getElementById('signupTos');
    if (tosBox) tosBox.required = mode === 'signup';
  }
  if (loginIdField) {
    const label = loginIdField.querySelector('.field-label');
    const input = loginIdField.querySelector('input');
    if (mode === 'signup') {
      if (label) label.textContent = 'Email';
      if (input) {
        input.type = 'email';
        input.placeholder = 'you@email.com';
      }
    } else {
      if (label) label.textContent = 'Email or username';
      if (input) {
        input.type = 'text';
        input.placeholder = 'email or username';
      }
    }
  }
}

async function emailFromUsername(username) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/email_for_username`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ uname: username })
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (typeof data === 'string' && data.includes('@')) return data.toLowerCase();
  return null;
}

authForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authForm.email.value.trim().toLowerCase();
  const password = authForm.password.value;
  const username = (authForm.username?.value || '').trim().toLowerCase();
  authNote.textContent = 'Working...';

  try {
    if (authMode === 'signup') {
      if (!email.includes('@')) {
        throw new Error('Use a real email when creating an account.');
      }
      if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
        throw new Error('Username must be 3-20 characters: letters, numbers, . _ -');
      }
      if (!document.getElementById('signupTos')?.checked) {
        throw new Error('You must agree to the Terms of Service and Privacy Policy to create an account.');
      }
      const tosVersion = await fetchTosVersion();
      const takenRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/username_taken`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ uname: username })
      });
      if (takenRes.ok && (await takenRes.json()) === true) {
        throw new Error('That username is already taken.');
      }
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          email,
          password,
          data: { username, tos_version: tosVersion, tos_agreed_at: new Date().toISOString() }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Sign up failed');
      const token = data.access_token || data.session?.access_token;
      const userId = data.user?.id || data.id;
      if (token) {
        await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_my_username`, {
          method: 'POST',
          headers: headers(token),
          body: JSON.stringify({ uname: username })
        });
        await rpc('accept_tos', {}, token).catch(() => {});
      }
      authNote.textContent = 'Account created. You can sign in now.';
      setAuthMode('signin');
      document.querySelectorAll('.auth-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.mode === 'signin');
      });
      return;
    }

    let loginEmail = email;
    if (!loginEmail.includes('@')) {
      loginEmail = await emailFromUsername(loginEmail);
      if (!loginEmail) throw new Error('No account found with that username.');
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email: loginEmail, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Sign in failed');

    saveSession(data);
    authModal.hidden = true;
    await loadProfile();
  } catch (err) {
    authNote.textContent = err.message;
  }
});

document.getElementById('saveUsernameBtn')?.addEventListener('click', async () => {
  const note = document.getElementById('usernameNote');
  const value = (document.getElementById('usernameEdit')?.value || '').trim().toLowerCase();
  if (!currentSession?.access_token || !currentSession.user?.id) {
    if (note) note.textContent = 'Sign in first.';
    return;
  }
  if (!/^[a-z0-9._-]{3,20}$/.test(value)) {
    if (note) note.textContent = 'Use 3-20 characters: letters, numbers, . _ -';
    return;
  }
  if (note) note.textContent = 'Saving...';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_my_username`, {
    method: 'POST',
    headers: headers(currentSession.access_token),
    body: JSON.stringify({ uname: value })
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || result === false) {
    if (note) note.textContent = (result && result.message) || 'Could not save username. It may already be taken.';
    return;
  }
  if (currentProfile) currentProfile.username = value;
  updateStaffUI();
  if (note) note.textContent = 'Username saved.';
});

document.getElementById('authSignOutLink')?.addEventListener('click', async () => {
  if (currentSession?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: headers(currentSession.access_token)
    }).catch(() => {});
  }
  localStorage.removeItem('mokio_session');
  rememberRole('');
  currentSession = null;
  currentProfile = null;
  if (window.MOKIO_REQUIRED_ROLES) {
    location.replace(homePath());
    return;
  }
  updateStaffUI({ confirmed: true });
});

const STAFF_ROLES = ['owner', 'mod', 'tester', 'dev'];

function saveSession(data) {
  currentSession = {
    access_token: data.access_token || currentSession?.access_token,
    refresh_token: data.refresh_token || currentSession?.refresh_token,
    user: data.user || currentSession?.user || null
  };
  localStorage.setItem('mokio_session', JSON.stringify(currentSession));
}

function cachedRole() {
  try {
    return (localStorage.getItem('mokio_role') || '').toLowerCase();
  } catch (_) {
    return '';
  }
}

function rememberRole(role) {
  try {
    if (role) localStorage.setItem('mokio_role', String(role).toLowerCase());
    else localStorage.removeItem('mokio_role');
  } catch (_) {}
}

function tokenExpired(token) {
  if (!token || typeof token !== 'string') return true;
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch (_) {
    return false;
  }
}

async function refreshSession() {
  const refreshToken = currentSession?.refresh_token;
  if (!refreshToken) return false;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) return false;
  saveSession(data);
  return true;
}

async function ensureFreshSession() {
  if (!currentSession?.access_token && !currentSession?.refresh_token) return false;
  if (tokenExpired(currentSession.access_token)) {
    const ok = await refreshSession();
    if (!ok) return false;
  }
  return Boolean(currentSession?.access_token);
}

async function fetchProfileRows() {
  const userId = currentSession?.user?.id;
  const email = (currentSession?.user?.email || '').toLowerCase();
  const token = currentSession.access_token;

  if (userId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,role,username`,
      { headers: headers(token) }
    );
    if (res.status === 401) return { unauthorized: true, rows: [] };
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]) return { rows };
    }
  }

  if (email) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,role,username`,
      { headers: headers(token) }
    );
    if (res.status === 401) return { unauthorized: true, rows: [] };
    if (res.ok) return { rows: await res.json() };
  }

  return { rows: [] };
}

async function loadProfile() {
  if (!currentSession?.access_token && !currentSession?.refresh_token) {
    currentProfile = null;
    rememberRole('');
    updateStaffUI({ confirmed: true });
    return;
  }

  const fresh = await ensureFreshSession();
  if (!fresh) {
    currentSession = null;
    currentProfile = null;
    localStorage.removeItem('mokio_session');
    rememberRole('');
    updateStaffUI({ confirmed: true });
    return;
  }

  if (!currentSession.user?.id) {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: headers(currentSession.access_token)
    });
    if (userRes.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) {
        const retry = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: headers(currentSession.access_token)
        });
        if (retry.ok) currentSession.user = await retry.json();
      }
    } else if (userRes.ok) {
      currentSession.user = await userRes.json();
      saveSession(currentSession);
    }
  }

  let result = await fetchProfileRows();
  if (result.unauthorized) {
    const refreshed = await refreshSession();
    if (refreshed) result = await fetchProfileRows();
  }

  currentProfile = Array.isArray(result.rows) ? result.rows[0] : null;
  if (currentProfile?.role) rememberRole(currentProfile.role);

  const metaName = (currentSession.user?.user_metadata?.username || '').toLowerCase();
  if (currentProfile && !currentProfile.username && metaName) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_my_username`, {
      method: 'POST',
      headers: headers(currentSession.access_token),
      body: JSON.stringify({ uname: metaName })
    });
    currentProfile.username = metaName;
  }

  updateStaffUI({ confirmed: Boolean(currentProfile) || !currentSession });
  if (document.getElementById('accountsBody')) loadAccounts();
  checkTos();
}

function normalizedRole() {
  return (currentProfile?.role || cachedRole() || '').toLowerCase();
}

function hasRole(...roles) {
  const role = normalizedRole();
  return Boolean(role && roles.map((r) => String(r).toLowerCase()).includes(role));
}

function isStaff() {
  return hasRole(...STAFF_ROLES);
}

function homePath() {
  return /\/(pages|Legal)\//.test(location.pathname) ? '../index.html' : 'index.html';
}

function updateStaffUI(opts = {}) {
  const confirmed = Boolean(opts.confirmed);
  const signedIn = Boolean(currentSession?.access_token);
  const btnText = document.getElementById('accountBtnText');
  const email = currentProfile?.email || currentSession?.user?.email || '';
  if (btnText) btnText.textContent = signedIn ? 'Account' : 'Sign In';
  if (authGuest) authGuest.hidden = signedIn;
  if (authSignedIn) authSignedIn.hidden = !signedIn;
  const username = currentProfile?.username || '';
  if (document.getElementById('authUserName')) {
    document.getElementById('authUserName').textContent = username ? '@' + username : 'Account';
  }
  if (document.getElementById('usernameEdit') && username) {
    document.getElementById('usernameEdit').value = username;
  }
  if (document.getElementById('authUserEmail')) {
    document.getElementById('authUserEmail').hidden = !email;
    document.getElementById('authUserEmail').textContent = email;
  }
  if (document.getElementById('authUserRole')) {
    document.getElementById('authUserRole').textContent = currentProfile?.role || 'member';
  }
  const initial = ((username || email)[0] || 'M').toUpperCase();
  document.querySelectorAll('.account-btn-icon, #authAvatar').forEach((el) => {
    el.textContent = initial;
  });

  const allowed = isStaff();
  if (staffNavLink) staffNavLink.hidden = !allowed;
  if (staffSection) staffSection.hidden = false;

  const welcome = document.getElementById('staffWelcome');
  if (welcome) {
    if (allowed) {
      const who = currentProfile?.email || currentSession?.user?.email || 'staff';
      const role = currentProfile?.role || cachedRole() || 'staff';
      welcome.textContent = `Signed in as ${who} — role: ${role}`;
    } else if (signedIn) {
      welcome.textContent = 'Your account is pending. An owner must assign you a role.';
    }
  }

  document.querySelectorAll('[data-roles]').forEach((el) => {
    const needed = el.dataset.roles.split(',').map((r) => r.trim());
    el.hidden = !hasRole(...needed);
  });

  const required = window.MOKIO_REQUIRED_ROLES;
  if (required && required.length && confirmed && !hasRole(...required)) {
    location.replace(homePath());
  }
}

async function loadAccounts() {
  const body = document.getElementById('accountsBody');
  const note = document.getElementById('accountsNote');
  if (!body || !hasRole('owner')) return;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=username,email,role,created_at&order=created_at.desc`,
    { headers: headers(currentSession.access_token) }
  );

  if (!res.ok) {
    note.textContent = 'Could not load accounts. Check the owner SQL policies.';
    return;
  }

  const rows = await res.json();
  note.textContent = `${rows.length} account${rows.length === 1 ? '' : 's'}`;
  body.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.username || ''}</td>
      <td>${row.email || ''}</td>
      <td>
        <select class="role-select" data-email="${row.email}">
          ${['member','tester','mod','dev','owner'].map((role) =>
            `<option value="${role}" ${row.role === role ? 'selected' : ''}>${role}</option>`
          ).join('')}
        </select>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('.role-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const email = select.dataset.email;
      const role = select.value;
      note.textContent = `Updating ${email}...`;
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: { ...headers(currentSession.access_token), Prefer: 'return=minimal' },
          body: JSON.stringify({ role })
        }
      );
      note.textContent = updateRes.ok ? `Updated ${email} to ${role}.` : 'Could not update role.';
    });
  });
}

// ======================
// Terms of Service
// ======================
const TOS_PATH = location.pathname.includes('/pages/')
  ? '../Legal/terms-of-service.html'
  : location.pathname.includes('/Legal/')
    ? 'terms-of-service.html'
    : 'Legal/terms-of-service.html';
const PRIVACY_PATH = TOS_PATH.replace('terms-of-service.html', 'privacy-policy.html');

function rpc(name, body = {}, token = SUPABASE_ANON_KEY) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body)
  });
}

async function fetchTosVersion() {
  try {
    const res = await rpc('get_tos_version');
    if (!res.ok) return null;
    const v = Number(await res.json());
    return Number.isFinite(v) ? v : null;
  } catch (_) {
    return null;
  }
}

async function signOutNow() {
  if (currentSession?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: headers(currentSession.access_token)
    }).catch(() => {});
  }
  localStorage.removeItem('mokio_session');
  rememberRole('');
  currentSession = null;
  currentProfile = null;
  location.replace(homePath());
}

let tosGateOpen = false;

// If the signed-in user has not accepted the current Terms, block the site until they do.
async function checkTos() {
  if (!currentSession?.access_token || tosGateOpen) return;
  try {
    const token = currentSession.access_token;
    const [curRes, accRes] = await Promise.all([
      rpc('get_tos_version'),
      rpc('my_tos_version', {}, token)
    ]);
    // If the SQL setup is missing or the check fails, do not lock people out.
    if (!curRes.ok || !accRes.ok) return;
    const current = Number(await curRes.json());
    const accepted = Number(await accRes.json());
    if (!Number.isFinite(current) || !Number.isFinite(accepted) || accepted >= current) return;

    // Brand-new account that ticked the box at sign-up (before first sign-in).
    const signedUpVersion = Number(currentSession.user?.user_metadata?.tos_version);
    if (accepted === 0 && Number.isFinite(signedUpVersion) && signedUpVersion >= current) {
      const ok = await rpc('accept_tos', {}, token);
      if (ok.ok) return;
    }
    showTosGate(accepted === 0);
  } catch (_) {}
}

function showTosGate(firstTime) {
  if (tosGateOpen) return;
  tosGateOpen = true;
  document.body.style.overflow = 'hidden';
  if (authModal) authModal.hidden = true;

  const gate = document.createElement('div');
  gate.className = 'modal tos-gate';
  gate.id = 'tosGate';
  gate.innerHTML = `
    <div class="modal-card auth-card tos-gate-card" role="dialog" aria-modal="true" aria-labelledby="tosGateTitle">
      <div class="auth-brand">
        <div class="auth-avatar">§</div>
        <h2 id="tosGateTitle">${firstTime ? 'Accept our Terms and Privacy Policy' : 'We updated our Terms and Privacy Policy'}</h2>
        <p class="auth-sub">${firstTime
          ? 'To keep using your Mokio account, please review and accept the Terms of Service and Privacy Policy.'
          : 'To keep using your Mokio account, you need to review and accept the updated Terms and Privacy Policy.'}</p>
      </div>
      <label class="tos-check tos-gate-check">
        <input type="checkbox" id="tosGateCheck">
        <span>I have read and agree to the <a href="${TOS_PATH}" target="_blank" rel="noopener">Terms of Service</a> and <a href="${PRIVACY_PATH}" target="_blank" rel="noopener">Privacy Policy</a></span>
      </label>
      <button type="button" class="btn btn-primary auth-submit" id="tosGateAgree" disabled>Agree and continue</button>
      <button type="button" class="btn btn-secondary auth-signout" id="tosGateDecline">Decline and sign out</button>
      <p class="form-note auth-note" id="tosGateNote"></p>
    </div>`;
  document.body.appendChild(gate);

  const check = gate.querySelector('#tosGateCheck');
  const agree = gate.querySelector('#tosGateAgree');
  const note = gate.querySelector('#tosGateNote');
  check.addEventListener('change', () => { agree.disabled = !check.checked; });

  agree.addEventListener('click', async () => {
    if (!check.checked) return;
    agree.disabled = true;
    note.textContent = 'Saving...';
    try {
      let res = await rpc('accept_tos', {}, currentSession.access_token);
      if (res.status === 401 && (await refreshSession())) {
        res = await rpc('accept_tos', {}, currentSession.access_token);
      }
      if (!res.ok) throw new Error('failed');
      gate.remove();
      tosGateOpen = false;
      document.body.style.overflow = '';
    } catch (_) {
      note.textContent = 'Could not save your agreement. Please try again.';
      agree.disabled = false;
    }
  });

  gate.querySelector('#tosGateDecline').addEventListener('click', signOutNow);
}

// Owner panel: force everyone to accept the updated Terms.
async function initTosAdmin() {
  const label = document.getElementById('tosVersionLabel');
  const btn = document.getElementById('forceTosBtn');
  const note = document.getElementById('tosAdminNote');
  if (!label || !btn) return;

  const v = await fetchTosVersion();
  label.textContent = v ?? 'unknown (run the SQL setup)';

  btn.addEventListener('click', async () => {
    if (!currentSession?.access_token) {
      note.textContent = 'Sign in as an owner first.';
      return;
    }
    const sure = confirm(
      'Force every user to accept the updated Terms of Service?\n\n' +
      'Anyone who has not accepted will be blocked from using their account until they do.'
    );
    if (!sure) return;
    btn.disabled = true;
    note.textContent = 'Updating...';
    try {
      let res = await rpc('force_tos_reaccept', {}, currentSession.access_token);
      if (res.status === 401 && (await refreshSession())) {
        res = await rpc('force_tos_reaccept', {}, currentSession.access_token);
      }
      if (!res.ok) throw new Error('failed');
      const newV = Number(await res.json());
      label.textContent = newV;
      note.textContent = `Done. Terms version ${newV} is now required for every user.`;
    } catch (_) {
      note.textContent = 'Could not update. Make sure the SQL setup was run and you are signed in as an owner.';
    } finally {
      btn.disabled = false;
    }
  });
}

// Inject the sign-up checkbox and a footer link on every page that has them.
(function injectTosUI() {
  if (authForm && !document.getElementById('signupTosField')) {
    const label = document.createElement('label');
    label.className = 'tos-check';
    label.id = 'signupTosField';
    label.hidden = true;
    label.innerHTML =
      `<input type="checkbox" id="signupTos">` +
      `<span>I agree to the <a href="${TOS_PATH}" target="_blank" rel="noopener">Terms of Service</a> and <a href="${PRIVACY_PATH}" target="_blank" rel="noopener">Privacy Policy</a></span>`;
    authForm.insertBefore(label, authSubmit);
  }
  document.querySelectorAll('.footer-links').forEach((links) => {
    [[TOS_PATH, 'terms-of-service.html', 'Terms of Service'],
     [PRIVACY_PATH, 'privacy-policy.html', 'Privacy Policy']].forEach(([href, file, text]) => {
      if (links.querySelector(`a[href$="${file}"]`)) return;
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      links.appendChild(a);
    });
  });
})();

initTosAdmin();

// Restore session
try {
  const saved = JSON.parse(localStorage.getItem('mokio_session') || 'null');
  if (saved?.access_token || saved?.refresh_token) {
    currentSession = saved;
    if (cachedRole()) updateStaffUI({ confirmed: false });
    loadProfile();
  } else if (window.MOKIO_REQUIRED_ROLES) {
    location.replace(homePath());
  } else {
    updateStaffUI({ confirmed: true });
  }
} catch (_) {
  updateStaffUI({ confirmed: true });
}
