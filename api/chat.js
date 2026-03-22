// ============================================================
// NEXUS — api/chat.js
// Vercel Serverless Function
//
// Responsibilities:
//   1. Forward chat requests to Groq (Llama 3.3 70B)
//   2. Save session analytics to Supabase in background
//
// Environment variables (set in Vercel dashboard — never hardcode):
//   GROQ_API_KEY       — from console.groq.com
//   SUPABASE_URL       — from Supabase → Settings → API
//   SUPABASE_ANON_KEY  — publishable key from Supabase → Settings → API
// ============================================================

export default async function handler(req, res) {

  // ── CORS ─────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Destructure request body ──────────────────────────────
  const {
    model,
    messages,
    max_tokens,
    temperature,
    top_p,
    sessionId,
    taskDescription,
    meta
  } = req.body;

  // ── Validate ──────────────────────────────────────────────
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // ── 1. Call Groq ──────────────────────────────────────────
  let groqData;
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model:       model       || 'llama-3.3-70b-versatile',
        messages,
        max_tokens:  max_tokens  || 8000,
        temperature: temperature || 0.7,
        top_p:       top_p       || 0.9
      })
    });

    groqData = await groqRes.json();

    if (!groqRes.ok) {
      console.error('Groq error:', groqData);
      return res.status(groqRes.status).json({ error: 'Groq API error', details: groqData });
    }

  } catch (err) {
    console.error('Groq fetch failed:', err.message);
    return res.status(500).json({ error: 'Failed to reach Groq', details: err.message });
  }

  // ── 2. Respond to client immediately ─────────────────────
  // Supabase save happens after — never blocks the user
  res.status(200).json(groqData);

  // ── 3. Save analytics to Supabase (fire and forget) ──────
  const replyText = groqData?.choices?.[0]?.message?.content || '';
  saveAnalytics({ sessionId, taskDescription, meta, messages, replyText })
    .catch(err => console.error('Supabase save failed:', err.message));
}


// ============================================================
// ANALYTICS — Save to Supabase
// ============================================================
async function saveAnalytics({ sessionId, taskDescription, meta, messages, replyText }) {

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  // Skip silently if env vars are missing or no session
  if (!SUPABASE_URL || !SUPABASE_KEY || !sessionId) return;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=minimal'  // Faster — don't return row data
  };

  // ── Create session on first message ──────────────────────
  if (meta?.isFirstMessage) {

    await dbInsert(SUPABASE_URL, headers, 'sessions', {
      id:           sessionId,
      domain:       meta.domain     || null,
      budget:       meta.budget     || null,
      skill_level:  meta.skillLevel || null,
      pipeline_mode: false,
      total_steps:  0
    });

    // Save the raw task the user typed
    if (taskDescription) {
      await dbInsert(SUPABASE_URL, headers, 'user_tasks', {
        session_id:      sessionId,
        task_description: taskDescription,
        detected_domain:  meta.domain || null
      });
    }
  }

  // ── Save latest user message ──────────────────────────────
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    await dbInsert(SUPABASE_URL, headers, 'messages', {
      session_id: sessionId,
      role:       'user',
      content:    lastUserMsg.content
    });
  }

  // ── Save AI reply ─────────────────────────────────────────
  if (replyText) {
    await dbInsert(SUPABASE_URL, headers, 'messages', {
      session_id: sessionId,
      role:       'assistant',
      content:    replyText
    });
  }

  // ── Update session with final tool recommendations ────────
  // Fires only on turn 4 when the AI outputs the JSON block
  if (replyText.includes('|||JSON_START')) {
    try {
      const match = replyText.match(/\|\|\|JSON_START\s*([\s\S]*?)\s*\|\|\|JSON_END/);
      if (match) {
        const parsed     = JSON.parse(match[1]);
        const isPipeline = parsed.mode === 'pipeline';
        const tools      = isPipeline
          ? parsed.pipeline.map(s => s.tool)
          : (parsed.tools || []);

        await dbPatch(SUPABASE_URL, headers, 'sessions', sessionId, {
          recommended_tools: tools,
          pipeline_mode:     isPipeline,
          total_steps:       isPipeline ? parsed.pipeline.length : 1,
          domain:            parsed.domain || null
        });
      }
    } catch (e) {
      // Non-critical — skip silently
      console.warn('Analytics JSON parse skipped:', e.message);
    }
  }
}


// ============================================================
// SUPABASE REST HELPERS
// ============================================================

// Insert a new row into a table
async function dbInsert(url, headers, table, data) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await res.text();
      console.warn(`DB insert [${table}] failed:`, msg);
    }
  } catch (e) {
    console.warn(`DB insert [${table}] error:`, e.message);
  }
}

// Update an existing row by id
async function dbPatch(url, headers, table, id, data) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method:  'PATCH',
      headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await res.text();
      console.warn(`DB patch [${table}] failed:`, msg);
    }
  } catch (e) {
    console.warn(`DB patch [${table}] error:`, e.message);
  }
}
