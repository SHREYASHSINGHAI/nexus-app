export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, sessionId, taskDescription, meta } = req.body;

    // ── 1. Forward to Groq ──────────────────────────────────
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        max_tokens: 8000,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: 'Groq error', details: data });
    }

    const replyText = data.choices[0].message.content;

    // ── 2. Save to Supabase in background ───────────────────
    // We don't await this — fire and forget so it doesn't slow the user
    saveToSupabase({
      sessionId,
      taskDescription,
      meta,
      messages,
      replyText
    }).catch(err => console.error('Supabase save error:', err));

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}

async function saveToSupabase({ sessionId, taskDescription, meta, messages, replyText }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };

  // Create session on first message (turn 1 only)
  if (meta && meta.isFirstMessage && sessionId) {
    await fetch(`${supabaseUrl}/rest/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: sessionId,
        domain: meta.domain || null,
        budget: meta.budget || null,
        skill_level: meta.skillLevel || null,
        pipeline_mode: false
      })
    });

    // Save the task description
    if (taskDescription) {
      await fetch(`${supabaseUrl}/rest/v1/user_tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: sessionId,
          task_description: taskDescription,
          detected_domain: meta.domain || null
        })
      });
    }
  }

  // Save the latest user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg && sessionId) {
    await fetch(`${supabaseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        role: 'user',
        content: lastUserMsg.content
      })
    });
  }

  // Save the AI reply
  if (replyText && sessionId) {
    await fetch(`${supabaseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session_id: sessionId,
        role: 'assistant',
        content: replyText
      })
    });
  }

  // Update session with final recommendations if JSON detected
  if (replyText && replyText.includes('|||JSON_START') && sessionId) {
    try {
      const jsonMatch = replyText.match(/\|\|\|JSON_START\s*([\s\S]*?)\s*\|\|\|JSON_END/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        const tools = parsed.mode === 'pipeline'
          ? parsed.pipeline.map(s => s.tool)
          : (parsed.tools || []);
        await fetch(`${supabaseUrl}/rest/v1/sessions?id=eq.${sessionId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            recommended_tools: tools,
            pipeline_mode: parsed.mode === 'pipeline',
            total_steps: parsed.pipeline ? parsed.pipeline.length : 1,
            domain: parsed.domain || null
          })
        });
      }
    } catch(e) { /* ignore parse errors */ }
  }
}
