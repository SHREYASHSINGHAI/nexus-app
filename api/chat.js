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

// Server-side cache for speculative search results (keyed by sessionId)
const searchCache = new Map();

function cleanSearchCache() {
  const now = Date.now();
  for (const [k, v] of searchCache.entries()) {
    if (now - v.timestamp > 30 * 60 * 1000) searchCache.delete(k);
  }
}

export default async function handler(req, res) {

  // ── CORS ─────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
    meta,
    isFinalTurn: clientIsFinalTurn,
    action,
    stream: clientStream
  } = req.body;

  // ── Speculative pre-fetch action ─────────────────────────
  if (action === 'prefetch_search') {
    if (sessionId && taskDescription && process.env.TAVILY_API_KEY) {
      cleanSearchCache();
      searchAITools(taskDescription, meta)
        .then(ctx => {
          if (ctx) {
            searchCache.set(sessionId, { context: ctx, timestamp: Date.now() });
            console.log(`[PREFETCH] Cached live search context for session: ${sessionId} (${ctx.length} chars)`);
          }
        })
        .catch(err => console.warn('[PREFETCH] search failed:', err.message));
    }
    return res.status(200).json({ status: 'prefetch_initiated' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // ── Authenticate User from Supabase JWT ───────────────────
  let userId = null;
  let userEmail = null;

  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ') && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const token = authHeader.slice(7).trim();
    try {
      const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`
        }
      });
      if (userRes.ok) {
        const u = await userRes.json();
        userId = u?.id || null;
        userEmail = u?.email || null;
      }
    } catch (e) {
      console.warn('[AUTH] Token verification error:', e.message);
    }
  }

  // Secure Database Credentials (Service Role Key preferred)
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const adminHeaders = {
    apikey: adminKey,
    Authorization: `Bearer ${adminKey}`,
    'Content-Type': 'application/json'
  };

  // ── Verify session limits & enforce quotas ────────────────
  let sub;

  // OPTIMIZATION: Only hit Supabase on the FIRST message (turn 1).
  if (meta?.isFirstMessage) {
    try {
      if (!process.env.SUPABASE_URL || !adminKey) {
        console.warn('[SUPABASE] Missing Supabase credentials, skipping quota verification.');
      } else if (!userId) {
        // ── ANONYMOUS LOGIC ──────────────────────────────────────
        const ipAddress = req.headers['x-forwarded-for'] || '0.0.0.0';
        const anonId = meta?.anonId || 'unknown';
        const fp = meta?.fingerprint || 'unknown';

        const checkUrl = `${process.env.SUPABASE_URL}/rest/v1/anon_usage?or=(anon_id.eq.${anonId},fingerprint.eq.${fp},ip_address.eq.${ipAddress})&select=*`;
        const resData = await fetch(checkUrl, { headers: adminHeaders });

        if (resData.ok) {
          const records = await resData.json();
          const myRecord = Array.isArray(records) ? records.find(r => r.anon_id === anonId) : null;
          if (myRecord) {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/anon_usage?anon_id=eq.${anonId}`, {
              method: 'PATCH',
              headers: adminHeaders,
              body: JSON.stringify({ search_count: myRecord.search_count + 1 })
            });
          } else {
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/anon_usage`, {
              method: 'POST',
              headers: adminHeaders,
              body: JSON.stringify({ anon_id: anonId, fingerprint: fp, ip_address: ipAddress, search_count: 1 })
            });
          }
        }
      } else {
        // ── REGISTERED LOGIC ─────────────────────────────────────
        const subRes = await fetch(
          `${process.env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=*`,
          { headers: adminHeaders }
        );
        if (subRes.ok) {
          const subData = await subRes.json();
          sub = Array.isArray(subData) ? subData[0] : null;

          // If no subscription record, create a default free one
          if (!sub) {
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            sub = {
              user_id: userId,
              plan_id: 'free',
              status: 'active',
              sessions_used: 0,
              quota: 3,
              week_reset_date: nextWeek.toISOString(),
              active_until: new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
            };
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscriptions`, {
              method: 'POST',
              headers: adminHeaders,
              body: JSON.stringify(sub)
            });
          }

          // Check rolling week reset
          const now = new Date();
          if (new Date(sub.week_reset_date) < now) {
            sub.sessions_used = 0;
            sub.week_reset_date = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
              method: 'PATCH',
              headers: adminHeaders,
              body: JSON.stringify({ sessions_used: 0, week_reset_date: sub.week_reset_date })
            });
          }

          // Check monthly expiry
          if (sub.plan_id !== 'free' && new Date(sub.active_until) < now) {
            sub.plan_id = 'free';
            sub.quota = 3;
            await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
              method: 'PATCH',
              headers: adminHeaders,
              body: JSON.stringify({ plan_id: 'free', quota: 3 })
            });
          }

          // Enforce quota
          if (sub.sessions_used >= sub.quota) {
            return res.status(429).json({
              error: 'session_limit',
              message: sub.plan_id === 'free' ? 'Free limit reached.' : 'Weekly session limit reached.'
            });
          }

          // SUCCESS: Increment the counter so they consume 1 credit for this task
          await fetch(`${process.env.SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
            method: 'PATCH',
            headers: adminHeaders,
            body: JSON.stringify({ sessions_used: sub.sessions_used + 1 })
          });
        }
      }
    } catch (err) {
      console.warn('[SUPABASE] Session quota check error (non-fatal):', err.message);
    }
  }

  // ── Detect if this is the final recommendation turn ──────
  const userMessages = messages.filter(m => m.role === 'user');
  const isFinalTurn = typeof clientIsFinalTurn === 'boolean'
    ? clientIsFinalTurn
    : (userMessages.length >= 4);

  // ── Step 1: Tavily search (with speculative cache check) ──
  let searchContext = '';
  if (isFinalTurn) {
    if (sessionId && searchCache.has(sessionId)) {
      searchContext = searchCache.get(sessionId).context;
      searchCache.delete(sessionId);
      console.log(`[TAVILY] Used prefetched search cache for session ${sessionId} (${searchContext.length} chars)`);
    } else if (process.env.TAVILY_API_KEY) {
      try {
        searchContext = await searchAITools(taskDescription, meta);
        console.log('[TAVILY] Live search completed — context length:', searchContext.length);
      } catch (err) {
        console.warn('Tavily search failed — proceeding without:', err.message);
      }
    }
  }

  // ── Step 2: Build enriched messages for Groq ─────────────
  let enrichedMessages = [...messages];

  if (isFinalTurn) {
    enrichedMessages = messages.map(m => {
      if (m.role === 'system') {
        let content = m.content
          .replace(/\|\|\|JSON_START\s*/g, '')
          .replace(/\|\|\|JSON_END/g, '')
          .replace(/starting with \|\|\|JSON_START and ending with \|\|\|JSON_END/g, 'as a valid JSON object');

        if (searchContext) {
          content += `\n\n` +
            `════════════════════════════════════════\n` +
            `LIVE AI TOOL DATA FROM theresanaiforthat.com\n` +
            `(Use this current data to supplement your recommendations)\n` +
            `════════════════════════════════════════\n` +
            searchContext +
            `\n════════════════════════════════════════\n` +
            `INSTRUCTION: Prioritise recommending tools from the live data above when they match the user's requirements better than your training data.`;
        }
        content += `\n\nCRITICAL MANDATORY INSTRUCTION: You are generating final recommendations. You MUST return ONLY a valid, parseable JSON object beginning with { and ending with }. Do NOT write any markdown fences (no \`\`\`json). Do NOT output any conversational text before or after the JSON.`;
        return { ...m, content };
      }
      return m;
    });
  }

  // ── Step 3: Call Groq with retry on rate limit ────────────
  if (!process.env.GROQ_API_KEY) {
    console.error('[GROQ] GROQ_API_KEY environment variable is not configured.');
    return res.status(500).json({
      error: 'groq_auth',
      message: 'GROQ_API_KEY is not configured. Please add it in Vercel → Settings → Environment Variables.'
    });
  }

  const requestedModel = process.env.GROQ_MODEL || model || 'llama-3.3-70b-versatile';
  let activeModel = await resolveGroqModel(requestedModel, process.env.GROQ_API_KEY);

  const shouldStream = Boolean(clientStream && !isFinalTurn);
  let groqData;
  let lastError;

  // Retry up to 3 times with exponential backoff on 429
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const groqPayload = {
        model: activeModel,
        messages: enrichedMessages,
        max_tokens: max_tokens || (isFinalTurn ? 2500 : 1200),
        temperature: isFinalTurn ? 0.25 : (temperature || 0.7),
        top_p: top_p || 0.9
      };

      // Native JSON mode for final recommendation turn
      if (isFinalTurn) {
        groqPayload.response_format = { type: 'json_object' };
      }
      if (shouldStream) {
        groqPayload.stream = true;
      }

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify(groqPayload)
      });

      // ── Handle rate limiting specifically ─────────────────
      if (groqRes.status === 429) {
        const retryAfter = groqRes.headers.get('retry-after') || groqRes.headers.get('x-ratelimit-reset-requests');
        const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : attempt * 2000;

        console.warn(`[GROQ] Rate limited on attempt ${attempt}. Waiting ${waitMs}ms before retry...`);
        lastError = { status: 429, message: 'rate_limit_exceeded' };

        if (attempt < 3) {
          await sleep(waitMs);
          continue; // retry
        } else {
          return res.status(429).json({
            error: 'rate_limit',
            message: 'NEXUS is experiencing high traffic right now. Please wait 30 seconds and try again.'
          });
        }
      }

      // ── Handle other Groq errors ──────────────────────────
      if (!groqRes.ok) {
        const errBody = await groqRes.json().catch(() => ({}));
        console.error(`[GROQ] Error HTTP ${groqRes.status}:`, errBody);

        const rawGroqMsg = errBody?.error?.message || errBody?.message || '';
        const groqCode   = errBody?.error?.code || '';

        // ── Handle Groq JSON mode validation error (graceful fallback) ──
        if (isFinalTurn && (rawGroqMsg.includes('Failed to generate JSON') || groqCode === 'json_validate_failed')) {
          console.warn(`[GROQ] JSON mode grammar error encountered ("${rawGroqMsg}"). Retrying immediately without response_format constraint...`);
          try {
            const fallbackPayload = {
              model: activeModel,
              messages: enrichedMessages,
              max_tokens: max_tokens || 2500,
              temperature: 0.2,
              top_p: 0.9
            };
            const fallbackRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
              },
              body: JSON.stringify(fallbackPayload)
            });
            if (fallbackRes.ok) {
              groqData = await fallbackRes.json();
              console.log('[GROQ] Fallback request succeeded without response_format constraint.');
              break;
            }
          } catch (fallbackErr) {
            console.error('[GROQ] Fallback attempt failed:', fallbackErr.message);
          }
        }

        // Authentication failure
        if (groqRes.status === 401 || rawGroqMsg.toLowerCase().includes('api key') || groqCode === 'invalid_api_key') {
          return res.status(401).json({
            error: 'groq_auth',
            message: 'GROQ_API_KEY is missing or invalid. Please update it in Vercel → Settings → Environment Variables.'
          });
        }

        // Model not found or decommissioned
        if (groqRes.status === 404 || groqCode === 'model_not_found' || groqCode === 'model_decommissioned' || rawGroqMsg.includes('does not exist') || rawGroqMsg.includes('decommissioned')) {
          const avail = await getAvailableGroqModels(process.env.GROQ_API_KEY, true);
          return res.status(404).json({
            error: 'groq_model',
            message: `Model "${activeModel}" is not available on your Groq key. Available models for your key: ${avail.slice(0, 5).join(', ') || 'none found'}. Visit /api/models to view full list.`
          });
        }

        // Context / token limit exceeded
        if (groqRes.status === 413 || groqCode === 'context_length_exceeded' || rawGroqMsg.includes('maximum context length')) {
          return res.status(413).json({
            error: 'context_length',
            message: 'Conversation context length exceeded. Please click "Start New Task" to begin a fresh session.'
          });
        }

        // Fallback for other Groq errors
        return res.status(groqRes.status).json({
          error: 'groq_error',
          message: rawGroqMsg || `AI provider returned error HTTP ${groqRes.status}.`
        });
      }

      // ── Handle SSE Streaming ──────────────────────────────
      if (shouldStream) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        let accumulatedContent = '';
        const reader = groqRes.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);

            // Accumulate tokens for Supabase analytics
            const lines = chunk.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) accumulatedContent += delta;
                } catch (_) {}
              }
            }
          }
        } finally {
          res.end();
        }

        // Save analytics in background
        saveAnalytics({ sessionId, taskDescription, meta, messages, replyText: accumulatedContent, verifiedUserId: userId, verifiedUserEmail: userEmail })
          .catch(err => console.error('Supabase save failed:', err.message));
        return;
      }

      // ── Success (Non-Streaming) ───────────────────────────
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
  saveAnalytics({ sessionId, taskDescription, meta, messages, replyText, verifiedUserId: userId, verifiedUserEmail: userEmail })
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
  const query = buildSearchQuery(taskDescription, domain, budget);
  console.log(`[TAVILY] Executing semantic search for query: "${query}"`);

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: query,
      search_depth: 'basic',
      include_domains: ['theresanaiforthat.com'],
      max_results: 8,
      include_answer: false,
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
      api_key: process.env.TAVILY_API_KEY,
      query: `best AI tools for ${query}`,
      search_depth: 'basic',
      max_results: 6,
      include_answer: false
    })
  });

  if (!tavilyRes.ok) return '';
  const data = await tavilyRes.json();
  if (!data.results?.length) return '';
  return formatSearchResults(data.results, query);
}

function buildSearchQuery(taskDescription, domain, budget) {
  if (!taskDescription) return domain || 'ai tools';

  // Strip conversational noise and boilerplate verbs
  const cleaned = taskDescription.toLowerCase()
    .replace(/\b(i want to|i need to|i'd like to|looking for|looking to|can you recommend|help me|suggest me|build a|build an|create a|create an|make a|make an|an ai that can|best tool for|best ai for|tool that can|app that can|how do i|please|software for|platform for|system for)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove common stop words to retain high-signal descriptive keywords
  const stopWords = new Set([
    'the','and','for','with','about','from','into','using','that','this','these','those',
    'what','which','who','whom','whose','when','where','why','how','all','any','both',
    'each','few','more','most','other','some','such','no','nor','not','only','own',
    'same','so','than','too','very','can','will','just','should','now','tool','tools','ai'
  ]);
  
  const words = cleaned.split(' ')
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  const coreKeywords = words.slice(0, 5).join(' ');

  const parts = [];
  if (coreKeywords) parts.push(coreKeywords);
  else parts.push(taskDescription.slice(0, 80));

  if (domain && domain !== 'null' && !coreKeywords.includes(domain.toLowerCase())) {
    parts.push(domain);
  }

  if (budget && (budget.toLowerCase().includes('free') || budget === 'Free only')) {
    parts.push('free');
  }

  return parts.join(' ').trim();
}

function formatSearchResults(results, query) {
  if (!results || results.length === 0) return '';

  const lines = [
    `Search query: "${query}"`,
    `Found ${results.length} relevant AI tools:\n`
  ];

  results.forEach((r, i) => {
    const rawTitle = (r.title || 'Unknown Tool').trim();
    // Clean "There's An AI For That" branding from tool title
    const title = rawTitle.replace(/\s*-\s*There's An AI For That.*$/i, '').trim();
    const url = (r.url || '').trim();
    const snippet = (r.content || r.snippet || '').trim().slice(0, 300);
    lines.push(`${i + 1}. ${title}`);
    if (url) lines.push(`   URL: ${url}`);
    if (snippet) lines.push(`   Description: ${snippet}`);
    lines.push('');
  });

  return lines.join('\n');
}


// ============================================================
// SUPABASE ANALYTICS
// ============================================================
async function saveAnalytics({ sessionId, taskDescription, meta, messages, replyText, verifiedUserId, verifiedUserEmail }) {

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY || !sessionId) return;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=minimal'
  };

  const userId = verifiedUserId || meta?.userId || null;
  const userEmail = verifiedUserEmail || meta?.userEmail || null;

  if (meta?.isFirstMessage) {
    await dbInsert(SUPABASE_URL, headers, 'sessions', {
      id: sessionId,
      domain: meta.domain || null,
      budget: meta.budget || null,
      skill_level: meta.skillLevel || null,
      pipeline_mode: false,
      total_steps: 0,
      user_id: userId,
      user_email: userEmail
    });

    if (taskDescription) {
      await dbInsert(SUPABASE_URL, headers, 'user_tasks', {
        session_id: sessionId,
        task_description: taskDescription,
        detected_domain: meta.domain || null,
        user_id: userId,
        user_email: userEmail
      });
    }
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg) {
    await dbInsert(SUPABASE_URL, headers, 'messages', {
      session_id: sessionId,
      role: 'user',
      content: lastUserMsg.content,
      user_id: userId,
      user_email: userEmail
    });
  }

  if (replyText) {
    await dbInsert(SUPABASE_URL, headers, 'messages', {
      session_id: sessionId,
      role: 'assistant',
      content: replyText,
      user_id: userId,
      user_email: userEmail
    });
  }

  // Parse recommended tools from replyText (direct JSON, delimited JSON, or substring JSON)
  let parsedRec = null;
  const trimmedReply = (replyText || '').trim();
  if (trimmedReply.startsWith('{') && trimmedReply.endsWith('}')) {
    try { parsedRec = JSON.parse(trimmedReply); } catch(_) {}
  }
  if (!parsedRec && replyText.includes('|||JSON_START')) {
    try {
      const match = replyText.match(/\|\|\|JSON_START\s*([\s\S]*?)\s*\|\|\|JSON_END/);
      if (match) parsedRec = JSON.parse(match[1]);
    } catch (_) {}
  }
  if (!parsedRec && replyText.includes('{') && replyText.includes('}')) {
    try {
      const s = replyText.indexOf('{');
      const e = replyText.lastIndexOf('}');
      parsedRec = JSON.parse(replyText.slice(s, e + 1));
    } catch (_) {}
  }

  if (parsedRec && (parsedRec.tools || parsedRec.pipeline)) {
    try {
      const isPipeline = parsedRec.mode === 'pipeline';
      const tools = isPipeline
        ? (parsedRec.pipeline || []).map(s => s.tool)
        : (parsedRec.tools || []);

      await dbPatch(SUPABASE_URL, headers, 'sessions', sessionId, {
        recommended_tools: tools,
        pipeline_mode: isPipeline,
        total_steps: isPipeline ? (parsedRec.pipeline || []).length : 1,
        domain: parsedRec.domain || null
      });
    } catch (e) {
      console.warn('Analytics JSON parse skipped:', e.message);
    }
  }
}

async function dbInsert(url, headers, table, data) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) console.warn(`DB insert [${table}] failed:`, await res.text());
  } catch (e) {
    console.warn(`DB insert [${table}] error:`, e.message);
  }
}

async function dbPatch(url, headers, table, id, data) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) console.warn(`DB patch [${table}] failed:`, await res.text());
  } catch (e) {
    console.warn(`DB patch [${table}] error:`, e.message);
  }
}


// ============================================================
// DYNAMIC GROQ MODEL RESOLUTION & FALLBACK
// ============================================================
let cachedGroqModels = null;
let lastCacheTimestamp = 0;

async function getAvailableGroqModels(apiKey, force = false) {
  const now = Date.now();
  if (!force && cachedGroqModels && (now - lastCacheTimestamp < 5 * 60 * 1000)) {
    return cachedGroqModels;
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const all = (data?.data || []).map(m => m.id);
      cachedGroqModels = all.filter(id => !id.includes('whisper') && !id.includes('guard'));
      lastCacheTimestamp = now;
      return cachedGroqModels;
    }
  } catch (err) {
    console.warn('[GROQ] Could not fetch models list:', err.message);
  }
  return cachedGroqModels || [];
}

async function resolveGroqModel(requestedModel, apiKey) {
  if (process.env.GROQ_MODEL) {
    return process.env.GROQ_MODEL;
  }

  const available = await getAvailableGroqModels(apiKey);
  if (!available || available.length === 0) {
    return requestedModel || 'openai/gpt-oss-120b';
  }

  // If requested model is available, use it
  if (requestedModel && available.includes(requestedModel)) {
    return requestedModel;
  }

  // Priority order of high-performance models
  const priority = [
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.1-8b-instant'
  ];

  for (const candidate of priority) {
    if (available.includes(candidate)) {
      console.log(`[GROQ] Requested model "${requestedModel}" not found on key. Auto-selected active model: "${candidate}"`);
      return candidate;
    }
  }

  return available[0] || requestedModel || 'openai/gpt-oss-120b';
}

