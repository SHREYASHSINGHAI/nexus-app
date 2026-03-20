export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, system, max_tokens } = req.body;

    // Convert Anthropic message format → Gemini format
    const geminiMessages = [];

    // Inject system prompt as first exchange so Gemini follows instructions
    if (system) {
      geminiMessages.push({
        role: 'user',
        parts: [{ text: `SYSTEM INSTRUCTIONS — follow these exactly for the entire conversation:\n\n${system}` }]
      });
      geminiMessages.push({
        role: 'model',
        parts: [{ text: 'Understood. I will follow these instructions exactly for the entire conversation.' }]
      });
    }

    // Add the actual conversation messages
    for (const m of messages) {
      geminiMessages.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: max_tokens || 4000,
            temperature: 0.7,
            topP: 0.9
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Gemini API error', details: errText });
    }

    const data = await response.json();

    // Safety check — make sure we got a valid response
    if (!data.candidates || data.candidates.length === 0) {
      return res.status(500).json({ error: 'No response from Gemini', raw: data });
    }

    const text = data.candidates[0]?.content?.parts?.[0]?.text || '';

    // Return in Anthropic format so index.html works without any changes
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (error) {
    return res.status(500).json({ error: 'API call failed', details: error.message });
  }
}
