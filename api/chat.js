// ============================================================
// NEXUS — api/chat.js
// Vercel Serverless Function (Refactored Entry Point)
// ============================================================

import { searchAITools } from './lib/tavily.js';
import { saveAnalytics } from './lib/supabase.js';
import Groq from 'groq-sdk';

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
  } = req.body || {};

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

  // ── Step 3: Call Groq via official SDK ───────────────────
  let groqResponse;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    groqResponse = await groq.chat.completions.create({
      model:       model       || 'llama-3.3-70b-versatile',
      messages:    enrichedMessages,
      max_tokens:  max_tokens  || 8000,
      temperature: temperature || 0.7,
      top_p:       top_p       || 0.9
    });
  } catch (err) {
    const errMsg = err?.message || String(err);
    console.error('Groq SDK call failed:', errMsg);
    if (err?.status === 429) {
      return res.status(429).json({
        error: 'rate_limit',
        message: 'NEXUS is experiencing high traffic right now. Please wait a moment and try again.'
      });
    }
    return res.status(err?.status || 500).json({
      error: 'network_error',
      message: errMsg || 'Could not reach the AI service. Please check your connection and try again.'
    });
  }

  if (!groqResponse) {
    return res.status(500).json({ error: 'no_response', message: 'No response from AI service.' });
  }

  // ── Step 4: Save analytics to Supabase ────────────────────
  const replyText = groqResponse.choices?.[0]?.message?.content || '';
  try {
    await saveAnalytics({ sessionId, taskDescription, meta, messages, replyText });
  } catch (err) {
    console.error('Supabase save failed:', err.message);
  }

  // ── Step 5: Respond to client ─────────────────────────────
  res.status(200).json(groqResponse);
}
