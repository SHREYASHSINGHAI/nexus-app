// ============================================================
// NEXUS — js/ui.js
// UI Actions, Interactive Components, and Theme Toggles
// ============================================================

// ── BULLET FORMATTING ─────────────────────────────────────────
function formatBullets(text) {
  try {
    if (window.marked) {
      return marked.parse(text);
    }
  } catch (e) {
    console.warn('Marked formatting failed:', e);
  }
  return text.split('\n').map(line => {
    const t = line.trim();
    if (t.startsWith('•') || t.startsWith('-'))
      return `<div class="bullet-item"><span class="bullet-dot">▸</span><span>${t.replace(/^[•\-]\s*/,'')}</span></div>`;
    return t.length ? `<div class="bullet-plain">${t}</div>` : '';
  }).join('') || text;
}

// ── MESSAGE LIST ACTIONS ──────────────────────────────────────
function addMessage(role, content, options = null) {
  const el  = document.createElement('div');
  el.className = 'message';
  const uid  = Date.now() + Math.random();
  const isAI = role === 'ai' || role === 'assistant';
  const display = isAI ? formatBullets(stripMarkers(content || '')) : (content || '');
  el.innerHTML = `
    <div class="msg-avatar ${isAI ? 'ai' : 'user'}">${isAI ? 'NX' : 'U'}</div>
    <div class="msg-bubble">
      <div class="msg-sender">${isAI ? 'NEXUS' : 'YOU'}</div>
      <div class="msg-content ${isAI ? 'ai-msg' : 'user-msg'}">${display}</div>
      ${options ? buildOptionsHTML(options, uid) : ''}
    </div>`;
  const msgs = document.getElementById('messages');
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

function buildOptionsHTML(options, uid) {
  const btns = options.map(o => `<button class="option-btn" onclick="selectOption(this,'${o.replace(/'/g,"\\'")}')">${o}</button>`).join('');
  const oid  = `other-${uid}`;
  return `<div class="options-grid">${btns}<button class="option-btn other-btn" onclick="toggleOther(this,'${oid}')">✎ Other</button></div>
    <div class="other-input-row" id="${oid}" style="display:none;">
      <input class="other-text-input" type="text" placeholder="Type your answer..." onkeydown="otherKeydown(event,this)" />
      <button class="other-send-btn" onclick="sendOther(this)">→</button>
    </div>`;
}

function toggleOther(btn, id) {
  btn.closest('.options-grid').querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const row = document.getElementById(id);
  if (row) { row.style.display = 'flex'; row.querySelector('input').focus(); }
}

function otherKeydown(e, input) { 
  if (e.key==='Enter') { 
    e.preventDefault(); 
    sendOther(input.nextElementSibling); 
  } 
}

function sendOther(btn) { 
  const val = btn.previousElementSibling.value.trim(); 
  if (!val) return; 
  document.getElementById('userInput').value = val; 
  sendMessage(); 
}

function selectOption(btn, value) {
  btn.closest('.options-grid').querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  const row = btn.closest('.options-grid').parentElement.querySelector('.other-input-row');
  if (row) row.style.display = 'none';
  setTimeout(() => { 
    document.getElementById('userInput').value = value; 
    sendMessage(); 
  }, 280);
}

// ── TYPING STATUS & ANIMATIONS ────────────────────────────────
function showTyping(status = 'Thinking...') {
  const el = document.getElementById('typing-indicator');
  if (el) {
    const textEl = document.getElementById('typing-status-text');
    if (textEl) textEl.textContent = status;
    return;
  }
  const newEl = document.createElement('div');
  newEl.className = 'message'; newEl.id = 'typing-indicator';
  newEl.innerHTML = `<div class="msg-avatar ai">NX</div><div class="msg-bubble"><div class="msg-sender">NEXUS</div><div class="typing"><div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-status" id="typing-status-text">${status}</span></div></div>`;
  const msgs = document.getElementById('messages');
  msgs.appendChild(newEl); msgs.scrollTop = msgs.scrollHeight;
}

function hideTyping() { 
  const el = document.getElementById('typing-indicator'); 
  if (el) el.remove(); 
}

function startTypingStatusCycler(isFinalTurn) {
  if (window.typingTimers) {
    window.typingTimers.forEach(clearTimeout);
  }
  
  let steps = [];
  if (isFinalTurn) {
    steps = [
      { time: 0, text: 'Searching live web resources...' },
      { time: 2500, text: 'Analyzing tool documentation...' },
      { time: 5000, text: 'Selecting best matching AI tools...' },
      { time: 7500, text: 'Designing pipeline prompts...' },
      { time: 10000, text: 'Structuring execution guidance...' },
      { time: 13000, text: 'Finalizing recommendation report...' }
    ];
  } else {
    steps = [
      { time: 0, text: 'Thinking...' },
      { time: 1800, text: 'Drafting clarifying questions...' }
    ];
  }

  showTyping(steps[0].text);

  const timers = [];
  for (let i = 1; i < steps.length; i++) {
    const t = setTimeout(() => {
      showTyping(steps[i].text);
    }, steps[i].time);
    timers.push(t);
  }
  window.typingTimers = timers;
}

function stopTypingStatusCycler() {
  if (window.typingTimers) {
    window.typingTimers.forEach(clearTimeout);
    window.typingTimers = null;
  }
  hideTyping();
}

// ── SESSION LIMIT CLOCK ───────────────────────────────────────
const SESSION_LIMIT = 5;
function getSessionCount() {
  const key  = 'nexus_sessions_' + new Date().toDateString();
  return parseInt(localStorage.getItem(key) || '0');
}

function incrementSessionCount() {
  const key = 'nexus_sessions_' + new Date().toDateString();
  localStorage.setItem(key, getSessionCount() + 1);
}

function isSessionLimitReached() {
  if (currentUser) return false; 
  return getSessionCount() >= SESSION_LIMIT;
}

function showSessionLimitBanner() {
  document.getElementById('sessionLimitBanner').style.display = 'block';
}

// ── HISTORY ACTIONS ───────────────────────────────────────────
function openHistory() {
  if (!currentUser) { openAuthModal(); return; }
  document.getElementById('historyOverlay').style.display = 'flex';
  loadHistory();
}

function closeHistory() { 
  document.getElementById('historyOverlay').style.display = 'none'; 
}

function handleHistoryOverlayClick(e) { 
  if (e.target === e.currentTarget) closeHistory(); 
}

function generateSessionTitle(session) {
  if (session.task_description && session.task_description.trim().length > 3) {
    const t = session.task_description.trim();
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }
  const tools  = (session.recommended_tools || []).slice(0, 2);
  const domain = session.domain ? session.domain.charAt(0).toUpperCase() + session.domain.slice(1) : '';
  if (tools.length && domain) return `${domain} — ${tools.join(', ')}`;
  if (tools.length)            return tools.join(' · ');
  if (domain)                  return `${domain} task`;

  const date = new Date(session.created_at);
  return `Session — ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

let cachedSessions = []; 

async function loadHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '<div class="history-loading">Loading your sessions...</div>';
  const searchEl = document.getElementById('historySearch');
  if (searchEl) searchEl.value = '';

  try {
    const { data: sessions, error } = await sb
      .from('sessions')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    cachedSessions = sessions || [];
    renderHistoryList(cachedSessions);
  } catch(e) {
    list.innerHTML = `<div class="history-empty">Could not load history.<br>${e.message}</div>`;
  }
}

function filterHistory(query) {
  if (!query.trim()) { renderHistoryList(cachedSessions); return; }
  const q = query.toLowerCase();
  const filtered = cachedSessions.filter(s => {
    const title = generateSessionTitle(s).toLowerCase();
    const tools = (s.recommended_tools || []).join(' ').toLowerCase();
    const domain = (s.domain || '').toLowerCase();
    return title.includes(q) || tools.includes(q) || domain.includes(q);
  });
  renderHistoryList(filtered, query);
}

function renderHistoryList(sessions, query = '') {
  const list = document.getElementById('historyList');
  if (!sessions?.length) {
    list.innerHTML = query
      ? `<div class="history-empty">No sessions match "<strong>${escHtml(query)}</strong>"</div>`
      : '<div class="history-empty">No sessions yet.<br>Start a conversation and your recommendations will appear here.</div>';
    return;
  }
  list.innerHTML = '';
  sessions.forEach(session => {
    const card  = document.createElement('div');
    card.className = 'history-card';
    const date  = new Date(session.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const title = generateSessionTitle(session);
    const tools = (session.recommended_tools || []).slice(0, 3);
    card.innerHTML = `
      <div class="history-card-task">${escHtml(title)}</div>
      <div class="history-card-meta">
        <span class="history-card-date">${date}</span>
        <div class="history-card-tools">
          ${tools.map(t => `<span class="history-tool-chip">${escHtml(t.split(' ')[0])}</span>`).join('')}
          ${session.pipeline_mode ? '<span class="history-tool-chip" style="color:var(--accent2);border-color:rgba(0,212,170,0.3);">Pipeline</span>' : ''}
        </div>
      </div>`;
    card.onclick = () => reopenSession(session);
    list.appendChild(card);
  });
}

async function reopenSession(session) {
  closeHistory();
  try {
    const { data: msgs } = await sb
      .from('messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });
    if (!msgs?.length) return;

    messages = []; isFirstMessage = false;
    document.getElementById('messages').innerHTML = '';
    document.getElementById('resultsPanel').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏱</div>
        <div class="empty-title">Restoring session...</div>
      </div>`;

    msgs.forEach(m => {
      const isAI   = m.role === 'assistant';
      const cleaned = stripMarkers(m.content || '');
      if (!cleaned.trim()) return;
      addMessage(isAI ? 'ai' : 'user', cleaned);
    });

    const lastAIWithJSON = [...msgs].reverse().find(m =>
      m.role === 'assistant' && m.content && m.content.includes('|||JSON_START')
    );
    if (lastAIWithJSON) {
      parseAndRenderTools(lastAIWithJSON.content);
    } else {
      document.getElementById('resultsPanel').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◈</div>
          <div class="empty-title">Session Restored</div>
          <div class="empty-sub">This session did not complete to recommendations. Continue the conversation below.</div>
        </div>`;
    }

    messages = msgs.map(m => ({ role: m.role, content: m.content }));
  } catch(e) {
    console.warn('Could not reopen session:', e.message);
  }
}

// ── SHARE METHOD ──────────────────────────────────────────────
let currentShareId = null;
async function shareRecommendation() {
  const btn = document.getElementById('shareBtnMain') || document.querySelector('#resultsPanel .share-btn');
  if (!btn) return;
  btn.textContent = '⏳ Creating link...';
  try {
    const res  = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: SESSION_ID })
    });
    const data = await res.json();
    if (!data.shareId) throw new Error('No share ID returned');
    currentShareId = data.shareId;
    const shareUrl = `${window.location.origin}/r/${data.shareId}`;
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    btn.textContent = '✓ Link copied!';
    btn.classList.add('share-copied');
    showShareToast(shareUrl);
    setTimeout(() => { btn.textContent = '🔗 Share'; btn.classList.remove('share-copied'); }, 3000);
  } catch(e) {
    btn.textContent = '🔗 Share';
    alert('Could not create share link. Please try again.');
  }
}

function showShareToast(url) {
  const existing = document.getElementById('shareToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'share-toast';
  toast.id = 'shareToast';
  toast.innerHTML = `<span>🔗 Share link ready</span><button class="share-toast-copy" onclick="copyShareUrl('${url}')">Copy URL</button>`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

function copyShareUrl(url) {
  navigator.clipboard.writeText(url).catch(() => {});
  const btn = document.querySelector('.share-toast-copy');
  if (btn) { btn.textContent = '✓ Copied'; }
}

// ── SEND & RESET CHAT ─────────────────────────────────────────
async function sendMessage() {
  if (isThinking) return;

  if (isFirstMessage && isSessionLimitReached()) {
    showSessionLimitBanner();
    return;
  }

  const input = document.getElementById('userInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';
  document.querySelectorAll('.option-btn').forEach(b => { b.disabled=true; b.style.opacity='0.4'; });

  if (isFirstMessage) incrementSessionCount();

  addMessage('user', text);
  isThinking = true;

  const userCount   = messages.filter(m => m.role === 'user').length + 1;
  const lastUserMsg = text.toLowerCase().trim();
  const isConfirmNo = lastUserMsg.includes('no') ||
                      lastUserMsg.includes('generate') ||
                      lastUserMsg.includes('proceed') ||
                      lastUserMsg.includes('yes, i want');
  const isFinalTurn = userCount >= 4 || (userCount >= 3 && isConfirmNo);

  startTypingStatusCycler(isFinalTurn);

  try {
    let reply = await callGroq(text);
    stopTypingStatusCycler();

    const hasJSON     = reply.includes('|||JSON_START');

    if (isFinalTurn && !hasJSON) {
      startTypingStatusCycler(true);
      addMessage('ai', '• Generating structured recommendations...');
      const retryReply = await callGroq(
        'Output the final recommendations NOW using ONLY the |||JSON_START ... |||JSON_END format. ' +
        'Do not write any text outside the JSON block. ' +
        'Use all requirements gathered so far.'
      );
      stopTypingStatusCycler();
      reply = retryReply;
    }

    const toolResult = parseAndRenderTools(reply);
    if (toolResult !== null) {
      addMessage('ai', toolResult || '• Analysis complete. Recommendations loaded →');
    } else {
      addMessage('ai', stripMarkers(reply), parseOptions(reply));
    }
  } catch(e) {
    stopTypingStatusCycler();
    let errMsg = '• Connection error. Please try again.';
    try {
      const parsed = JSON.parse(e.message);
      if (parsed.error === 'rate_limit') {
        errMsg = '• NEXUS is experiencing high traffic right now.\n• Please wait 30 seconds and try again.';
      } else if (parsed.error === 'network_error') {
        errMsg = '• Could not reach the AI service.\n• Please check your connection and try again.';
      }
    } catch(_) { }
    addMessage('ai', errMsg);
    console.error('Groq error:', e);
  }
  isThinking = false;
}

function handleKey(e)   { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }

function resetApp() {
  messages=[]; isFirstMessage=true; firstTaskDescription=''; lastRecommendationData=null;
  document.getElementById('messages').innerHTML='';
  document.getElementById('sessionLimitBanner').style.display='none';
  document.getElementById('resultsPanel').innerHTML=`<div class="empty-state"><div class="empty-icon">◈</div><div class="empty-title">Awaiting Analysis</div><div class="empty-sub">Describe your task in the chat and NEXUS will identify the best AI tools for your specific needs.</div></div>`;
  setTimeout(addWelcomeMessage, 100);
}

function addWelcomeMessage() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  addMessage('ai', `• ${greeting} — I'm <strong>NEXUS</strong>, your AI Tool Intelligence System.\n• Tell me what you want to build or accomplish, and I'll find the perfect AI tool for you.\n• I search live databases to recommend tools beyond my built-in list.`);

  setTimeout(() => {
    const examples = [
      '💻 Build a personal portfolio website for free',
      '🎨 Generate product images for my e-commerce store',
      '📊 Automate my weekly sales report from Google Sheets'
    ];
    const msgEl = document.querySelector('.messages .message:last-child .msg-content');
    if (!msgEl) return;
    const label = document.createElement('span');
    label.className = 'example-prompt-label';
    label.textContent = 'Try an example:';
    msgEl.appendChild(label);
    const grid = document.createElement('div');
    grid.className = 'example-prompts';
    examples.forEach(ex => {
      const btn = document.createElement('button');
      btn.className = 'example-prompt-btn';
      btn.textContent = ex;
      btn.onclick = () => {
        document.getElementById('userInput').value = ex.replace(/^[^\s]+\s/, '');
        sendMessage();
      };
      grid.appendChild(btn);
    });
    msgEl.appendChild(grid);
  }, 400);
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-mode');
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
    if (window.lucide) {
      lucide.createIcons();
    }
  }
  localStorage.setItem('nexus-theme', isLight ? 'light' : 'dark');
}
