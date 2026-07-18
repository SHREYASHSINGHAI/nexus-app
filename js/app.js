// ============================================================
// NEXUS — js/app.js
// Application Entry Point & Initialization
// ============================================================

// ── IMMEDATE THEME DETECTION ──────────────────────────────────
(function() {
  if (localStorage.getItem('nexus-theme') === 'light') {
    document.body.classList.add('light-mode');
  }
})();

// ── APPLICATION SETUP ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set correct theme icon depending on initial body class
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon && document.body.classList.contains('light-mode')) {
    themeIcon.setAttribute('data-lucide', 'sun');
  }

  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // Attach auth modal click-outside closer
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.addEventListener('click', function(e) { 
      if (e.target === this) closeAuthModal(); 
    });
  }

  // Initialize services
  initSupabase();
  addWelcomeMessage();
});
