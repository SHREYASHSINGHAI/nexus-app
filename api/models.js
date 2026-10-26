// ============================================================
// NEXUS — api/models.js
// Diagnostic endpoint to list active Groq models for your key
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'groq_auth',
      message: 'GROQ_API_KEY environment variable is not configured in Vercel.'
    });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await groqRes.json();
    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: 'groq_api_error',
        message: data?.error?.message || 'Failed to fetch models from Groq.',
        groqResponse: data
      });
    }

    const allModels = (data?.data || []).map(m => m.id);
    const chatModels = allModels.filter(id => !id.includes('whisper') && !id.includes('guard'));

    return res.status(200).json({
      status: 'success',
      totalModels: allModels.length,
      chatModels,
      allModels
    });
  } catch (err) {
    return res.status(500).json({ error: 'network_error', message: err.message });
  }
}
