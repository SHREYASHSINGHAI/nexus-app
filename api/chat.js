// ============================================================
// NEXUS — api/chat.js
// Vercel Serverless Function
//
// Flow:
//   1. Receive chat request from frontend
//   2. If turn 4 (final recommendations) → search theresanaiforthat.com via Tavily
//   3. Inject search results into Llama prompt as live context
//   4. Call Groq (Llama 3.3 70B) — with automatic retry on rate limit
//   5. Return response to frontend
//   6. Save analytics to Supabase in background (fire and forget)
//
// Environment variables (set in Vercel dashboard):
//   GROQ_API_KEY      — from console.groq.com
//   TAVILY_API_KEY    — from app.tavily.com
//   SUPABASE_URL      — from Supabase → Settings → API
//   SUPABASE_ANON_KEY — publishable key from Supabase → Settings → API
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

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // ── Detect if this is turn 4 (final recommendation turn) ─
  const userMessages = messages.filter(m => m.role === 'user');
  const isFinalTurn  = userMessages.length >= 3;

  // ── Step 1: Tavily search on turn 4 ──────────────────────
  let searchContext = '';
  if (isFinalTurn && process.env.TAVILY_API_KEY) {
    try {
      searchContext = await searchAITools(taskDescription, meta);
      console.log('Tavily search completed — context length:', searchContext.length);
    } catch (err) {
      // Tavily failure is non-fatal — proceed without live data
      console.warn('Tavily search failed — proceeding without:', err.message);
    }
  }

  // ── Step 2: Build enriched messages for Groq ─────────────
  let enrichedMessages = [...messages];

  if (searchContext && isFinalTurn) {
    enrichedMessages = messages.map(m => {
      if (m.role === 'system') {
        return {
          ...m,
          content: m.content + `\n\n` +
            `════════════════════════════════════════\n` +
            `LIVE AI TOOL DATA FROM theresanaiforthat.com\n` +
            `(Use this current data to supplement your recommendations)\n` +
            `════════════════════════════════════════\n` +
            searchContext +
            `\n════════════════════════════════════════\n` +
            `INSTRUCTION: Prioritise recommending tools from the live data above when they match the user's requirements better than your training data.`
        };
      }
      return m;
    });
  }

  // ── Step 3: Call Groq with retry on rate limit ────────────
  let groqData;
  let lastError;

  // Retry up to 3 times with exponential backoff on 429
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model:       model       || 'llama-3.3-70b-versatile',
          messages:    enrichedMessages,
          max_tokens:  max_tokens  || 8000,
          temperature: temperature || 0.7,
          top_p:       top_p       || 0.9
        })
      });

      // ── Handle rate limiting specifically ─────────────────
      if (groqRes.status === 429) {
        const retryAfter = groqRes.headers.get('retry-after') || groqRes.headers.get('x-ratelimit-reset-requests');
        const waitMs     = retryAfter ? parseFloat(retryAfter) * 1000 : attempt * 2000;

        console.warn(`Groq rate limited on attempt ${attempt}. Waiting ${waitMs}ms before retry...`);
        lastError = { status: 429, message: 'rate_limit_exceeded' };

        if (attempt < 3) {
          await sleep(waitMs);
          continue; // retry
        } else {
          // All retries exhausted — return a user-friendly message
          return res.status(429).json({
            error: 'rate_limit',
            message: 'NEXUS is experiencing high traffic right now. Please wait a moment and try again.'
          });
        }
      }

      // ── Handle other Groq errors ──────────────────────────
      if (!groqRes.ok) {
        const errBody = await groqRes.json().catch(() => ({ error: 'unknown' }));
        console.error(`Groq error ${groqRes.status}:`, errBody);

        // Don't retry on non-rate-limit errors
        return res.status(groqRes.status).json({
          error: 'groq_error',
          details: errBody
        });
      }

      // ── Success ───────────────────────────────────────────
      groqData = await groqRes.json();
      break; // exit retry loop

    } catch (err) {
      console.error(`Groq fetch error on attempt ${attempt}:`, err.message);
      lastError = err;

      if (attempt < 3) {
        await sleep(attempt * 1500);
        continue;
      }

      return res.status(500).json({
        error: 'network_error',
        message: 'Could not reach the AI service. Please check your connection and try again.'
      });
    }
  }

  if (!groqData) {
    return res.status(500).json({ error: 'no_response', message: 'No response from AI service.' });
  }

  // ── Step 4: Respond to client immediately ─────────────────
  res.status(200).json(groqData);

  // ── Step 5: Save analytics to Supabase (fire and forget) ──
  const replyText = groqData?.choices?.[0]?.message?.content || '';
  saveAnalytics({ sessionId, taskDescription, meta, messages, replyText })
    .catch(err => console.error('Supabase save failed:', err.message));
}


// ============================================================
// SLEEP UTILITY
// ============================================================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// TAVILY SEARCH — theresanaiforthat.com
// ============================================================
async function searchAITools(taskDescription, meta) {
  if (!taskDescription) return '';

  const domain = meta?.domain || '';
  const budget = meta?.budget || '';
  const query  = buildSearchQuery(taskDescription, domain, budget);

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:             process.env.TAVILY_API_KEY,
      query:               query,
      search_depth:        'advanced',
      include_domains:     ['theresanaiforthat.com'],
      max_results:         8,
      include_answer:      false,
      include_raw_content: false
    })
  });

  if (!tavilyRes.ok) {
    const err = await tavilyRes.text();
    throw new Error(`Tavily error ${tavilyRes.status}: ${err}`);
  }

  const data = await tavilyRes.json();

  if (!data.results || data.results.length === 0) {
    return await searchAIToolsFallback(query);
  }

  return formatSearchResults(data.results, query);
}

async function searchAIToolsFallback(query) {
  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:        process.env.TAVILY_API_KEY,
      query:          `best AI tools for ${query}`,
      search_depth:   'basic',
      max_results:    6,
      include_answer: false
    })
  });

  if (!tavilyRes.ok) return '';
  const data = await tavilyRes.json();
  if (!data.results?.length) return '';
  return formatSearchResults(data.results, query);
}

function buildSearchQuery(taskDescription, domain, budget) {
  const parts = [];
  parts.push(taskDescription.slice(0, 120));
  if (domain && domain !== 'null') parts.push(domain);
  if (budget && (budget.toLowerCase().includes('free') || budget === 'Free only')) parts.push('free');
  return parts.join(' ');
}

function formatSearchResults(results, query) {
  if (!results || results.length === 0) return '';

  const lines = [
    `Search query: "${query}"`,
    `Found ${results.length} relevant AI tools:\n`
  ];

  results.forEach((r, i) => {
    const title   = (r.title   || 'Unknown Tool').trim();
    const url     = (r.url     || '').trim();
    const snippet = (r.content || r.snippet || '').trim().slice(0, 300);
    lines.push(`${i + 1}. ${title}`);
    if (url)     lines.push(`   URL: ${url}`);
    if (snippet) lines.push(`   Description: ${snippet}`);
    lines.push('');
  });

  return lines.join('\n');
}


// ============================================================
// SUPABASE ANALYTICS
// ============================================================
async function saveAnalytics({ sessionId, taskDescription, meta, messages, replyText }) {

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY || !sessionId) return;

  const headers = {
    'Content-Type': 'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer':        'return=minimal'
  };

  const userId    = meta?.userId    || null;
  const userEmail = meta?.userEmail || null;

  if (meta?.isFirstMessage) {
    await dbInsert(SUPABASE_URL, headers, 'sessions', {
      id:            sessionId,
      domain:        meta.domain     || null,
      budget:        meta.budget     || null,
      skill_level:   meta.skillLevel || null,
      pipeline_mode: false,
      total_steps:   0,
      user_id:       userId,
      user_email:    userEmail
    });

    if (taskDescription) {
      await dbInsert(SUPABASE_URL, headers, 'user_tasks', {
        session_id:       sessionId,
        task_description: taskDescription,
        detected_domain:  meta.domain || null,
        user_id:          userId,
        user_email:       userEmail
      });
    }
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    await dbInsert(SUPABASE_URL, headers, 'messages', {
      session_id: sessionId,
      role:       'user',
      content:    lastUserMsg.content,
      user_id:    userId,
      user_email: userEmail
    });
  }

  if (replyText) {
    await dbInsert(SUPABASE_URL, headers, 'messages', {
      session_id: sessionId,
      role:       'assistant',
      content:    replyText,
      user_id:    userId,
      user_email: userEmail
    });
  }

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
      console.warn('Analytics JSON parse skipped:', e.message);
    }
  }
}

async function dbInsert(url, headers, table, data) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method:  'POST',
      headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) console.warn(`DB insert [${table}] failed:`, await res.text());
  } catch (e) {
    console.warn(`DB insert [${table}] error:`, e.message);
  }
}

async function dbPatch(url, headers, table, id, data) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method:  'PATCH',
      headers,
      body:    JSON.stringify(data)
    });
    if (!res.ok) console.warn(`DB patch [${table}] failed:`, await res.text());
  } catch (e) {
    console.warn(`DB patch [${table}] error:`, e.message);
  }
}
