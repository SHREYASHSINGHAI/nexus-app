// ============================================================
// NEXUS — js/rendering.js
// HTML Generators, Card Builders, and PDF Export
// ============================================================

// ── PARSING ───────────────────────────────────────────────────
function parseOptions(reply) {
  const m = reply.match(/\|\|\|OPTIONS_START\s*([\s\S]*?)\s*\|\|\|OPTIONS_END/);
  if (!m) return null;
  try { return JSON.parse(m[1].trim()); } catch(e) { return null; }
}

function stripMarkers(reply) {
  return reply.replace(/\|\|\|OPTIONS_START[\s\S]*?\|\|\|OPTIONS_END/g,'').replace(/\|\|\|JSON_START[\s\S]*?\|\|\|JSON_END/g,'').trim();
}

function parseAndRenderTools(reply) {
  const m = reply.match(/\|\|\|JSON_START\s*([\s\S]*?)\s*\|\|\|JSON_END/);
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]);
    lastRecommendationData = data; // save for PDF export
    data.mode === 'pipeline' ? renderPipeline(data) : renderSingle(data);
    if (!currentUser) setTimeout(appendLoginBanner, 800);
    return stripMarkers(reply);
  } catch(e) {
    console.error("Failed to parse or render AI recommendations:", e);
    return null;
  }
}

// ── RENDER — Single ───────────────────────────────────────────
function renderSingle(data) {
  const panel = document.getElementById('resultsPanel');
  panel.innerHTML = '';
  panel.appendChild(makeEl('div', 'results-header', `Recommendations — ${(data.domain||'AI').toUpperCase()}`));

  // Action bar (PDF + Share)
  const bar = makeEl('div', 'results-action-bar');
  bar.innerHTML = `
    <button class="action-bar-btn pdf-btn" onclick="exportToPDF()">⬇ Download PDF</button>
    <button class="action-bar-btn share-btn" id="shareBtnMain" onclick="shareRecommendation()">🔗 Share</button>`;
  panel.appendChild(bar);

  const nb = makeEl('div', 'neutrality-banner');
  nb.innerHTML = `<span class="nb-icon">⚖</span><span>Recommendations based <strong>solely on your stated requirements</strong>. No tool is sponsored or preferred.</span>`;
  panel.appendChild(nb);

  const promptMap = {};
  (data.tool_prompts||[]).forEach(tp => { promptMap[tp.tool] = tp.prompts||[]; });
  const allTools = Object.values(AI_TOOLS_DB).flat();
  (data.tools || []).forEach((name, i) => {
    const tool  = allTools.find(t => t.name === name);
    const score = data.scores?.[i] || (90 - i * 8);
    const card  = tool
      ? createToolCard(tool, score, i===0, promptMap[name]||null)
      : createFallbackCard(name, score, i===0, promptMap[name]||null);
    card.style.animationDelay = `${i * 120}ms`;
    panel.appendChild(card);
  });

  const note = makeEl('div', '');
  note.style.cssText = 'padding:1rem;font-size:0.7rem;color:var(--muted);line-height:1.6;border-top:1px solid var(--border);margin-top:0.5rem;';
  note.textContent = `✦ ${data.reasoning}`;
  panel.appendChild(note);

  if (data.action_steps?.length) {
    panel.appendChild(buildActionSteps(data.action_steps, {}));
  }
}

// ── RENDER — Pipeline ─────────────────────────────────────────
function renderPipeline(data) {
  const panel = document.getElementById('resultsPanel');
  panel.innerHTML = '';
  const allTools = Object.values(AI_TOOLS_DB).flat();
  panel.appendChild(makeEl('div', 'results-header', `AI PIPELINE — ${(data.pipeline || []).length} SUBTASKS`));

  // Action bar
  const bar = makeEl('div', 'results-action-bar');
  bar.innerHTML = `
    <button class="action-bar-btn pdf-btn" onclick="exportToPDF()">⬇ Download PDF</button>
    <button class="action-bar-btn share-btn" id="shareBtnMain" onclick="shareRecommendation()">🔗 Share</button>`;
  panel.appendChild(bar);

  const sb2 = makeEl('div', 'pipeline-summary-banner');
  sb2.innerHTML = `<span class="psb-icon">◈</span><div><div class="psb-title">Multi-Tool Workflow Detected</div><div class="psb-text">${data.summary}</div></div>`;
  panel.appendChild(sb2);
  const nb = makeEl('div', 'neutrality-banner');
  nb.innerHTML = `<span class="nb-icon">⚖</span><span>Each subtask is assigned the <strong>best-fit tool</strong> based on requirements only — no brand bias.</span>`;
  panel.appendChild(nb);
  const container = makeEl('div', 'pipeline-container');
  (data.pipeline || []).forEach((step, idx) => {
    const tool  = allTools.find(t => t.name === step.tool);
    const sc    = step.fit_score >= 80 ? '#00d4aa' : step.fit_score >= 60 ? '#f59e0b' : '#ff6b6b';
    const icon  = tool?.icon  || '🔧';
    const color = tool?.color || '#7c5cfc';
    const node  = makeEl('div', 'pipeline-node');
    node.style.animationDelay = `${idx * 150}ms`;
    node.innerHTML = `
      <div class="pn-step-badge">STEP ${step.step}</div>
      <div class="pn-card" style="border-color:${color}44">
        <div class="pn-card-top">
          <div class="pn-icon" style="background:${color}18;border:1px solid ${color}44">${icon}</div>
          <div class="pn-meta">
            <div class="pn-subtask">${step.subtask}</div>
            <div class="pn-tool-name">${step.tool}</div>
            ${tool?.pricing ? `<div class="pn-pricing">${tool.pricing}</div>` : ''}
          </div>
          <div class="pn-score" style="color:${sc};border-color:${sc}44;background:${sc}10">${step.fit_score}%</div>
        </div>
        <div class="pn-description">${step.description}</div>
        <div class="pn-output-row"><span class="pn-output-label">OUTPUT →</span><span class="pn-output-text">${step.output}</span></div>
        ${tool?.tradeoff ? `<div class="pn-tradeoff"><span>⚖</span> ${tool.tradeoff}</div>` : ''}
        <div class="pn-guide-toggle" onclick="togglePnGuide(this)"><span class="arrow">▶</span> Quick Start Guide</div>
        <div class="pn-guide-steps">
          ${tool ? tool.guide.map((g,i) => `<div class="guide-step"><div class="step-num">${i+1}</div><div class="step-text"><strong>${g.title}</strong> — ${g.desc}</div></div>`).join('') : ''}
          ${tool ? `<a href="${tool.url}" target="_blank" class="tool-link">Open ${step.tool} ↗</a>` : `<a href="https://theresanaiforthat.com/s/${encodeURIComponent(step.tool)}" target="_blank" class="tool-link">Find ${step.tool} ↗</a>`}
        </div>
        ${step.prompts?.length ? buildPromptSection(step.prompts, step.tool) : ''}
      </div>`;
    container.appendChild(node);
    if (step.connects_to !== null && idx < data.pipeline.length - 1) {
      const conn = makeEl('div', 'pipeline-connector');
      conn.innerHTML = `<div class="pc-line"></div><div class="pc-arrow-head">▼</div><div class="pc-label">${step.output}</div>`;
      container.appendChild(conn);
    }
  });
  panel.appendChild(container);
  const orch = makeEl('div', 'orchestration-note');
  orch.innerHTML = `<span class="orch-icon">⟳</span><div><strong>Orchestration:</strong> ${data.orchestration}</div>`;
  panel.appendChild(orch);
  const rn = makeEl('div','');
  rn.style.cssText = 'padding:1rem;font-size:0.7rem;color:var(--muted);line-height:1.6;border-top:1px solid var(--border);';
  rn.textContent = `✦ ${data.reasoning}`;
  panel.appendChild(rn);
  if (data.action_steps?.length) {
    const pm = {};
    data.pipeline.forEach(s => { if (s.prompts?.length) pm[s.step] = s.prompts; });
    panel.appendChild(buildActionSteps(data.action_steps, pm));
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function makeEl(tag, cls, text='') {
  const el = document.createElement(tag);
  if (cls)  el.className   = cls;
  if (text) el.textContent = text;
  return el;
}
function togglePnGuide(el)       { el.classList.toggle('open'); el.nextElementSibling.classList.toggle('visible'); }
function toggleGuide(btn)        { btn.classList.toggle('open'); btn.nextElementSibling.classList.toggle('visible'); }
function togglePromptSection(el) { el.classList.toggle('open'); el.nextElementSibling.classList.toggle('visible'); }

function buildPromptSection(prompts, toolName) {
  const uid   = 'ps_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const cards = prompts.map((p, i) => {
    const pid = `${uid}_${i}`;
    return `<div class="prompt-card">
      <div class="prompt-card-header">
        <span class="prompt-label">⚡ ${p.label||'Prompt '+(i+1)}</span>
        <span class="prompt-purpose">${p.purpose||''}</span>
        <button class="prompt-copy-btn" onclick="copyText(this,'pt_${pid}')">⎘ Copy</button>
      </div>
      <div class="prompt-text" id="pt_${pid}">${escHtml(p.prompt)}</div>
      <div class="prompt-usage-hint"><span class="puh-icon">↗</span><span>Open <strong>${toolName||'the tool'}</strong> → paste this prompt directly into the input field</span></div>
    </div>`;
  }).join('');
  return `<div class="prompt-section">
    <div class="prompt-section-toggle open" onclick="togglePromptSection(this)">
      <span class="arrow" style="transform:rotate(90deg)">▶</span><span class="ps-icon">⚡</span>
      Ready-to-Use Prompts (${prompts.length})
    </div>
    <div class="prompt-cards-container visible">${cards}</div>
  </div>`;
}

function buildActionSteps(steps, promptMap) {
  const el       = makeEl('div', 'action-steps-section');
  const totalMin = steps.reduce((a,s) => a+(parseInt((s.duration||'').replace(/\D/g,''))||5), 0);
  const html = steps.map(s => {
    const prompts = (promptMap && (promptMap[s.step] || promptMap[s.tool])) || [];
    const inline  = prompts.map((p,i) => {
      const id = `ip_${s.step}_${i}_${Date.now().toString(36)}`;
      return `<div class="inline-prompt-block">
        <div class="ipb-header"><span class="ipb-label">⚡ ${p.label||'Prompt'}</span><span class="ipb-purpose">${p.purpose||''}</span><button class="ipb-copy-btn" onclick="copyText(this,'${id}')">⎘ Copy Prompt</button></div>
        <div class="ipb-text" id="${id}">${escHtml(p.prompt)}</div>
        <div class="ipb-instruction">↗ Paste this into <strong>${s.tool}</strong></div>
      </div>`;
    }).join('');
    return `<div class="action-step-row">
      <div class="action-step-num">${s.step}</div>
      <div class="action-step-body">
        <div class="action-step-action">${s.action}</div>
        ${inline}
        <div class="action-step-meta">
          ${s.tool     ? `<span class="action-step-tool">${s.tool}</span>` : ''}
          ${s.duration ? `<span class="action-step-duration">${s.duration}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<div class="action-steps-header"><span style="font-size:1rem">▶</span><div class="action-steps-title">Execution Roadmap</div><div class="action-steps-subtitle">~${totalMin} min total · ${steps.length} steps</div></div><div class="action-steps-list">${html}</div>`;
  return el;
}

function createToolCard(tool, score, isTop, prompts=null) {
  const card   = makeEl('div', `tool-card ${isTop ? 'top-pick' : ''}`);
  const circ   = 2 * Math.PI * 18;
  const offset = circ - (score/100) * circ;
  const sc     = score>=80 ? '#00d4aa' : score>=60 ? '#f59e0b' : '#ff6b6b';
  card.innerHTML = `
    ${isTop ? '<div class="highlight-rank"></div>' : ''}
    <div class="tool-card-header">
      <div class="tool-icon" style="background:${tool.color}18;border:1px solid ${tool.color}40">${tool.icon}</div>
      <div class="tool-meta">
        ${isTop ? '<div class="top-pick-label">★ Best Requirement Match</div>' : ''}
        <div class="tool-name">${tool.name}</div>
        <div class="tool-tagline">${tool.tagline}</div>
        <div class="tool-badges">
          <span class="badge badge-match" style="color:${sc};border-color:${sc}40;background:${sc}12">Fit ${score}%</span>
          <span class="badge badge-price">${tool.pricing}</span>
          <span class="badge badge-type">${tool.type}</span>
        </div>
      </div>
      <div class="score-ring">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="18" fill="none" stroke="var(--border)" stroke-width="3"/>
          <circle cx="26" cy="26" r="18" fill="none" stroke="${sc}" stroke-width="3" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
        </svg>
        <div class="score-num" style="color:${sc}">${score}</div>
      </div>
    </div>
    <div class="tool-desc">${tool.description}</div>
    ${tool.tradeoff ? `<div class="tradeoff-row"><span class="tradeoff-icon">⚖</span><span class="tradeoff-text"><strong>Honest tradeoff:</strong> ${tool.tradeoff}</span></div>` : ''}
    <div class="guide-section">
      <button class="guide-toggle" onclick="toggleGuide(this)"><span class="arrow">▶</span> Quick Start Guide</button>
      <div class="guide-steps">
        ${tool.guide.map((g,i) => `<div class="guide-step"><div class="step-num">${i+1}</div><div class="step-text"><strong>${g.title}</strong> — ${g.desc}</div></div>`).join('')}
        <a href="${tool.url}" target="_blank" class="tool-link">Open ${tool.name} ↗</a>
      </div>
    </div>
    ${prompts?.length ? buildPromptSection(prompts, tool.name) : ''}`;
  return card;
}

function createFallbackCard(toolName, score, isTop, prompts=null) {
  const card   = makeEl('div', `tool-card ${isTop ? 'top-pick' : ''}`);
  const circ   = 2 * Math.PI * 18;
  const offset = circ - (score/100) * circ;
  const sc     = score>=80 ? '#00d4aa' : score>=60 ? '#f59e0b' : '#ff6b6b';
  const initial = (toolName||'T').charAt(0).toUpperCase();
  card.innerHTML = `
    ${isTop ? '<div class="highlight-rank"></div>' : ''}
    <div class="tool-card-header">
      <div class="tool-icon" style="background:rgba(124,92,252,0.15);border:1px solid rgba(124,92,252,0.3);font-family:'Syne',sans-serif;font-weight:800;color:var(--accent);font-size:1.2rem;">${initial}</div>
      <div class="tool-meta">
        ${isTop ? '<div class="top-pick-label">★ Best Requirement Match</div>' : ''}
        <div class="tool-name">${toolName}</div>
        <div class="tool-tagline" style="font-style:normal;font-size:0.7rem;">Discovered via live search</div>
        <div class="tool-badges">
          <span class="badge badge-match" style="color:${sc};border-color:${sc}40;background:${sc}12">Fit ${score}%</span>
          <span class="badge" style="background:rgba(124,92,252,0.1);border:1px solid rgba(124,92,252,0.25);color:#a78bfa;">Live Search</span>
        </div>
      </div>
      <div class="score-ring">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="18" fill="none" stroke="var(--border)" stroke-width="3"/>
          <circle cx="26" cy="26" r="18" fill="none" stroke="${sc}" stroke-width="3" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
        </svg>
        <div class="score-num" style="color:${sc}">${score}</div>
      </div>
    </div>
    <div class="tool-desc">Recommended from live search data. May be newer or more specialised than tools in the core database.</div>
    <div class="guide-section">
      <a href="https://theresanaiforthat.com/s/${encodeURIComponent(toolName)}" target="_blank" class="tool-link">Find ${toolName} on There's An AI For That ↗</a>
    </div>
    ${prompts?.length ? buildPromptSection(prompts, toolName) : ''}`;
  return card;
}

function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function copyText(btn, id) {
  const el = document.getElementById(id);
  if (!el) return;
  const orig = btn.textContent;
  const done = () => { btn.textContent='✓ Copied!'; btn.classList.add('copied'); setTimeout(()=>{ btn.textContent=orig; btn.classList.remove('copied'); },2000); };
  if (navigator.clipboard) navigator.clipboard.writeText(el.textContent).then(done).catch(()=>{ fallbackCopy(el.textContent); done(); });
  else { fallbackCopy(el.textContent); done(); }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
}

function appendLoginBanner() {
  const panel = document.getElementById('resultsPanel');
  if (!panel || document.getElementById('loginBanner') || currentUser) return;
  const b = document.createElement('div');
  b.className = 'login-banner'; b.id = 'loginBanner';
  b.innerHTML = `<div class="login-banner-text"><div class="login-banner-title">💾 Save these recommendations</div><div class="login-banner-sub">Sign in for unlimited searches and full session history.</div></div><button class="login-banner-btn" onclick="openAuthModal()">Sign In →</button>`;
  panel.appendChild(b);
}

// ── PDF EXPORT ────────────────────────────────────────────────
function exportToPDF() {
  const panel = document.getElementById('resultsPanel');
  if (!panel || !lastRecommendationData) return;

  const opt = {
    margin:       10,
    filename:     `NEXUS_recommendations_${lastRecommendationData.domain || 'AI'}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  const element = document.createElement('div');
  element.style.padding = '20px';
  element.style.color = '#1a1a2e';
  element.style.fontFamily = 'Segoe UI, sans-serif';
  element.innerHTML = `
    <h1 style="font-size: 24px; color: #7c5cfc; margin-bottom: 5px; font-weight: 800;">◈ NEXUS Recommendations</h1>
    <div style="font-size: 11px; color: #666; margin-bottom: 25px;">Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · nexus-app.vercel.app</div>
    ${buildPDFContent()}
    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #999; text-align: center;">Generated by NEXUS — AI Tool Intelligence System. Verify details before use.</div>
  `;

  const style = document.createElement('style');
  style.innerHTML = `
    .tool  { border: 1px solid #e0e0e0; border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem; page-break-inside: avoid; }
    .tool-name { font-size: 1.1rem; font-weight: 700; color: #1a1a2e; margin-bottom: 0.3rem; }
    .tool-score { display: inline-block; background: #00d4aa20; border: 1px solid #00d4aa; border-radius: 4px; padding: 0.1rem 0.5rem; font-size: 0.75rem; color: #007a62; margin-bottom: 0.5rem; }
    .tool-desc { font-size: 0.85rem; color: #444; margin-bottom: 0.8rem; }
    .tradeoff  { font-size: 0.82rem; color: #aa4444; background: #fff0f0; padding: 0.5rem 0.8rem; border-radius: 6px; margin-bottom: 0.8rem; }
    .prompt-box { background: #fdf8ef; border: 1px solid #f59e0b; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem; page-break-inside: avoid; }
    .prompt-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #f59e0b; margin-bottom: 0.4rem; }
    .prompt-text  { font-family: monospace; font-size: 0.8rem; color: #5a4010; white-space: pre-wrap; word-break: break-word; }
    .step  { display: flex; gap: 0.8rem; padding: 0.6rem 0; border-bottom: 1px dashed #e0e0e0; page-break-inside: avoid; }
    .step:last-child { border-bottom: none; }
    .step-num { width: 24px; height: 24px; border-radius: 50%; background: #00d4aa20; border: 1px solid #00d4aa; color: #007a62; font-weight: 700; font-size: 0.7rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .step-text { font-size: 0.82rem; color: #333; }
    h2 { font-size: 1.1rem; color: #7c5cfc; margin: 1.5rem 0 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #7c5cfc20; padding-bottom: 5px; }
  `;
  element.appendChild(style);

  try {
    if (window.html2pdf) {
      html2pdf().set(opt).from(element).save();
    } else {
      console.warn('html2pdf library not found, printing via fallback');
      fallbackPrint();
    }
  } catch (e) {
    console.error('PDF export failed:', e);
    fallbackPrint();
  }

  function fallbackPrint() {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<html><head><title>NEXUS Recommendations</title><style>${style.innerHTML}</style></head><body>${element.innerHTML}</body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  }
}

function buildPDFContent() {
  const allTools = Object.values(AI_TOOLS_DB).flat();
  let html = '';

  if (lastRecommendationData) {
    const data = lastRecommendationData;
    if (data.summary) html += `<p style="color:#444;margin-bottom:1.5rem;">${escHtml(data.summary)}</p>`;

    if (data.mode === 'single') {
      html += '<h2>Recommended Tools</h2>';
      (data.tools || []).forEach((name, i) => {
        const tool  = allTools.find(t => t.name === name);
        const score = data.scores?.[i] || (90 - i * 8);
        const prompts = (data.tool_prompts || []).find(tp => tp.tool === name)?.prompts || [];
        html += `<div class="tool">
          <div class="tool-name">${escHtml(name)}</div>
          <span class="tool-score">Fit ${score}%</span>
          ${tool?.description ? `<div class="tool-desc">${escHtml(tool.description)}</div>` : ''}
          ${tool?.tradeoff    ? `<div class="tradeoff">⚖ Tradeoff: ${escHtml(tool.tradeoff)}</div>` : ''}
          ${prompts.map(p => `<div class="prompt-box"><div class="prompt-label">⚡ ${escHtml(p.label||'Prompt')}</div><div class="prompt-text">${escHtml(p.prompt)}</div></div>`).join('')}
        </div>`;
      });
    } else if (data.mode === 'pipeline') {
      html += '<h2>Pipeline Steps</h2>';
      (data.pipeline || []).forEach(step => {
        const tool    = allTools.find(t => t.name === step.tool);
        const prompts = step.prompts || [];
        html += `<div class="tool">
          <div style="font-size:0.65rem;text-transform:uppercase;color:#999;margin-bottom:0.3rem;">Step ${step.step} — ${escHtml(step.subtask||'')}</div>
          <div class="tool-name">${escHtml(step.tool)}</div>
          <span class="tool-score">Fit ${step.fit_score}%</span>
          ${step.description ? `<div class="tool-desc">${escHtml(step.description)}</div>` : ''}
          ${tool?.tradeoff   ? `<div class="tradeoff">⚖ ${escHtml(tool.tradeoff)}</div>` : ''}
          ${prompts.map(p => `<div class="prompt-box"><div class="prompt-label">⚡ ${escHtml(p.label||'Prompt')}</div><div class="prompt-text">${escHtml(p.prompt)}</div></div>`).join('')}
        </div>`;
      });
    }

    if (data.action_steps?.length) {
      html += '<h2>Execution Roadmap</h2><div>';
      data.action_steps.forEach(s => {
        html += `<div class="step"><div class="step-num">${s.step}</div><div class="step-text">${escHtml(s.action)} <span style="color:#999;font-size:0.75rem;">${escHtml(s.duration||'')}</span></div></div>`;
      });
      html += '</div>';
    }
  }

  return html || '<p style="color:#999">No recommendation data available.</p>';
}
