export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system, max_tokens } = req.body;

    const geminiMessages = [];

    if (system) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `SYSTEM INSTRUCTIONS:\n\n${system}` }]
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions exactly.' }]
      });
    }

    for (const m of messages) {
      geminiMessages.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: max_tokens || 4000,
            temperature: 0.7
          }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: 'Gemini error', details: data });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
