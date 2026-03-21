export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system, max_tokens } = req.body;

    // Build Groq messages array
    const groqMessages = [];

    // Add system prompt if present
    if (system) {
      groqMessages.push({
        role: 'system',
        content: system
      });
    }

    // Add conversation messages
    for (const m of messages) {
      groqMessages.push({
        role: m.role,
        content: m.content
      });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        max_tokens: max_tokens || 8000,
        temperature: 0.7,
        top_p: 0.9
      })
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: 'Groq error', details: data });
    }

    // Extract text from Groq response
    const text = data.choices?.[0]?.message?.content || '';

    // Return in Anthropic format so index.html works unchanged
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
