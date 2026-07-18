// ============================================================
// NEXUS — api/lib/supabase.js
// Supabase Database Analytics Helper (Using Official SDK)
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    console.error('Supabase initialization failed:', err.message);
  }
}

export async function saveAnalytics({ sessionId, taskDescription, meta, messages, replyText }) {
  if (!supabase || !sessionId) {
    if (!supabase) console.warn('Supabase SDK client not initialized (missing environment variables)');
    return;
  }

  const userId    = meta?.userId    || null;
  const userEmail = meta?.userEmail || null;

  try {
    if (meta?.isFirstMessage) {
      // Create session row first
      await supabase.from('sessions').insert({
        id:            sessionId,
        domain:        meta.domain     || null,
        budget:        meta.budget     || null,
        skill_level:   meta.skillLevel || null,
        pipeline_mode: false,
        total_steps:   0,
        user_id:       userId,
        user_email:    userEmail
      });

      // Insert related tasks and initial chat history in parallel
      const inserts = [];
      if (taskDescription) {
        inserts.push(supabase.from('user_tasks').insert({
          session_id:       sessionId,
          task_description: taskDescription,
          detected_domain:  meta.domain || null,
          user_id:          userId,
          user_email:       userEmail
        }));
      }

      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        inserts.push(supabase.from('messages').insert({
          session_id: sessionId,
          role:       'user',
          content:    lastUserMsg.content,
          user_id:    userId,
          user_email: userEmail
        }));
      }

      if (replyText) {
        inserts.push(supabase.from('messages').insert({
          session_id: sessionId,
          role:       'assistant',
          content:    replyText,
          user_id:    userId,
          user_email: userEmail
        }));
      }

      await Promise.all(inserts);
    } else {
      // Non-first turn: log messages in parallel
      const inserts = [];
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        inserts.push(supabase.from('messages').insert({
          session_id: sessionId,
          role:       'user',
          content:    lastUserMsg.content,
          user_id:    userId,
          user_email: userEmail
        }));
      }

      if (replyText) {
        inserts.push(supabase.from('messages').insert({
          session_id: sessionId,
          role:       'assistant',
          content:    replyText,
          user_id:    userId,
          user_email: userEmail
        }));
      }

      await Promise.all(inserts);
    }

    // Process result recommendation updates if present
    if (replyText.includes('|||JSON_START')) {
      try {
        const match = replyText.match(/\|\|\|JSON_START\s*([\s\S]*?)\s*\|\|\|JSON_END/);
        if (match) {
          const parsed     = JSON.parse(match[1]);
          const isPipeline = parsed.mode === 'pipeline';
          const tools      = isPipeline
            ? parsed.pipeline.map(s => s.tool)
            : (parsed.tools || []);

          await supabase.from('sessions').update({
            recommended_tools: tools,
            pipeline_mode:     isPipeline,
            total_steps:       isPipeline ? parsed.pipeline.length : 1,
            domain:            parsed.domain || null
          }).eq('id', sessionId);
        }
      } catch (e) {
        console.warn('Analytics JSON parse skipped:', e.message);
      }
    }
  } catch (err) {
    console.error('Database write error:', err.message);
  }
}
