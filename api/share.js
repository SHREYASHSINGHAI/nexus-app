// ============================================================
// NEXUS — api/share.js
// POST /api/share  → create a share link for a session
// GET  /api/share?id=xxx → retrieve a shared session
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  const missingVars = [];
  if (!SUPABASE_URL || !SUPABASE_URL.startsWith('http')) missingVars.push('SUPABASE_URL');
  if (!SUPABASE_KEY) missingVars.push('SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');

  if (missingVars.length > 0) {
    return res.status(500).json({
      error: 'server_config_error',
      message: `Missing or malformed environment variables: ${missingVars.join(', ')}`
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  };

  // ── GET: retrieve shared session ──────────────────────────
  if (req.method === 'GET') {
    const shareId = req.query.id;
    if (!shareId) return res.status(400).json({ error: 'share id required' });

    try {
      // Get session by share_id
      const sessionRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?share_id=eq.${shareId}&select=*`,
        { headers }
      );
      const sessions = await sessionRes.json();
      if (!sessions?.length) return res.status(404).json({ error: 'Share not found' });

      const session = sessions[0];

      // Get messages for this session
      const msgRes = await fetch(
        `${SUPABASE_URL}/rest/v1/messages?session_id=eq.${session.id}&order=created_at.asc&select=*`,
        { headers }
      );
      const messages = await msgRes.json();

      return res.status(200).json({ session, messages });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: create share link ───────────────────────────────
  if (req.method === 'POST') {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    try {
      // 1. Check existing session for share_id reuse and ownership
      const getRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionId}&select=id,user_id,share_id`,
        { headers }
      );

      if (getRes.ok) {
        const sessions = await getRes.json();
        if (Array.isArray(sessions) && sessions.length > 0) {
          const session = sessions[0];

          // If already has a share_id, reuse it immediately (idempotent)
          if (session.share_id) {
            return res.status(200).json({ shareId: session.share_id });
          }

          // If session belongs to an authenticated user, verify caller ownership
          if (session.user_id) {
            let callerUserId = null;
            const authHeader = req.headers['authorization'] || '';
            if (authHeader.startsWith('Bearer ') && process.env.SUPABASE_ANON_KEY) {
              const token = authHeader.slice(7).trim();
              const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: {
                  apikey: process.env.SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${token}`
                }
              });
              if (userRes.ok) {
                const u = await userRes.json();
                callerUserId = u?.id || null;
              }
            }

            if (!callerUserId || callerUserId !== session.user_id) {
              return res.status(403).json({
                error: 'forbidden',
                message: 'You do not have permission to share this session.'
              });
            }
          }
        }
      }

      // 2. Generate a short unique share ID (8 chars)
      const shareId = Math.random().toString(36).slice(2, 6) +
        Math.random().toString(36).slice(2, 6);

      // 3. Patch the session with the share_id
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?id=eq.${sessionId}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ share_id: shareId })
        }
      );

      if (!patchRes.ok) {
        const err = await patchRes.text();
        return res.status(500).json({ error: 'Failed to create share link', details: err });
      }

      return res.status(200).json({ shareId });

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
