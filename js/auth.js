// ============================================================
// NEXUS — js/auth.js
// Supabase Authentication Module
// ============================================================

const { createClient } = supabase;
let sb = null;
let currentUser = null;
let authTab = 'signin';

async function initSupabase() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    sb = createClient(cfg.supabaseUrl, cfg.supabaseAnon);
    
    const { data } = await sb.auth.getSession();
    currentUser = data?.session?.user || null;
    updateAuthUI();

    sb.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      updateAuthUI();
    });

    // Show login modal 2s after page load if not signed in
    setTimeout(() => { if (!currentUser) openAuthModal(); }, 2000);
  } catch(e) { 
    console.warn('Supabase init failed:', e.message); 
  }
}

function updateAuthUI() {
  const btn     = document.getElementById('authHeaderBtn');
  const histBtn = document.getElementById('historyBtn');
  if (!btn) return;
  if (currentUser) {
    btn.textContent = `● ${(currentUser.email||'').split('@')[0].slice(0,16)}`;
    btn.classList.add('signed-in');
    if (histBtn) histBtn.style.display = 'block';
  } else {
    btn.textContent = 'Sign In';
    btn.classList.remove('signed-in');
    if (histBtn) histBtn.style.display = 'none';
  }
}

function handleAuthBtnClick() {
  if (!sb) return;
  if (currentUser) { 
    if (confirm(`Sign out of ${currentUser.email}?`)) sb.auth.signOut(); 
  } else {
    openAuthModal();
  }
}

function openAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('authError').textContent = '';
  document.getElementById('authSuccess').style.display = 'none';
  document.getElementById('authEmail').value = '';
  document.getElementById('authPassword').value = '';
}

function closeAuthModal() { 
  document.getElementById('authModal').style.display = 'none'; 
}

function switchTab(tab) {
  authTab = tab;
  document.getElementById('tabSignIn').classList.toggle('active', tab === 'signin');
  document.getElementById('tabSignUp').classList.toggle('active', tab === 'signup');
  document.getElementById('authSubmitBtn').textContent = tab === 'signin' ? 'Sign In' : 'Create Account';
  document.getElementById('authError').textContent = '';
  document.getElementById('authSuccess').style.display = 'none';
}

async function signInWithGoogle() {
  if (!sb) return;
  const { error } = await sb.auth.signInWithOAuth({ 
    provider: 'google', 
    options: { redirectTo: window.location.origin } 
  });
  if (error) {
    document.getElementById('authError').textContent = error.message;
  }
}

async function submitAuth() {
  if (!sb) return;
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');
  const errEl = document.getElementById('authError');
  const sucEl = document.getElementById('authSuccess');
  
  if (!email || !password) { 
    errEl.textContent = 'Please enter email and password.'; 
    return; 
  }
  
  btn.disabled = true; 
  btn.textContent = 'Please wait...';
  errEl.textContent = ''; 
  sucEl.style.display = 'none';
  
  const { data, error } = authTab === 'signin'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });
    
  btn.disabled = false;
  btn.textContent = authTab === 'signin' ? 'Sign In' : 'Create Account';
  
  if (error) { 
    errEl.textContent = error.message; 
    return; 
  }
  
  if (authTab === 'signup' && !data?.session) {
    sucEl.textContent = '✓ Check your email to confirm your account.';
    sucEl.style.display = 'block';
    return;
  }
  closeAuthModal();
}
