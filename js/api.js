// ============================================================
// NEXUS — js/api.js
// API Client / Network requests
// ============================================================

async function callGroq(userMessage) {
  messages.push({ role: 'user', content: userMessage });
  if (isFirstMessage) firstTaskDescription = userMessage;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 8000, 
      temperature: 0.7, 
      top_p: 0.9,
      sessionId: SESSION_ID, 
      taskDescription: firstTaskDescription,
      meta: { 
        isFirstMessage, 
        domain: null, 
        budget: null, 
        skillLevel: null,
        userId: currentUser?.id || null, 
        userEmail: currentUser?.email || null 
      }
    })
  });

  if (!response.ok) { 
    const err = await response.json(); 
    throw new Error(JSON.stringify(err)); 
  }

  isFirstMessage = false;
  const data  = await response.json();
  const reply = data.choices[0].message.content;
  messages.push({ role: 'assistant', content: reply });
  return reply;
}
