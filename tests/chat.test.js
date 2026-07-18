import handler from '../api/chat.js';

async function testChat() {
  console.log('--- Testing Chat API Orchestrator ---');

  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      setHeader(name, val) { this.headers[name] = val; }
    };
  }

  // Test 1: Invalid HTTP Request Method
  try {
    const req = { method: 'GET' };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 405) throw new Error(`Expected 405, got ${res.statusCode}`);
    console.log('✓ Test 1 Passed: Invalid HTTP method rejected with 405.');
  } catch (err) {
    // Error: Non-POST HTTP request methods must return 405 Method Not Allowed error status.
    console.error('✗ Test 1 Failed:', err.message);
    process.exit(1);
  }

  // Test 2: Missing Messages List
  try {
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
    console.log('✓ Test 2 Passed: Missing messages rejected with 400.');
  } catch (err) {
    // Error: POST requests without messages array should throw 400 Bad Request error.
    console.error('✗ Test 2 Failed:', err.message);
    process.exit(1);
  }

  // Test 3: Missing Groq API Key
  const origKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = '';
  try {
    const req = { method: 'POST', body: { messages: [{ role: 'user', content: 'test' }] } };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 401 && res.statusCode !== 500) throw new Error(`Expected 401 or 500, got ${res.statusCode}`);
    console.log('✓ Test 3 Passed: Missing Groq credentials handled gracefully.');
  } catch (err) {
    // Error: Uninitialized Groq client keys must fall back to returning 401/500 status error codes.
    console.error('✗ Test 3 Failed:', err.message);
    process.exit(1);
  } finally {
    process.env.GROQ_API_KEY = origKey;
  }

  // Test 4: Undefined Request Body
  try {
    const req = { method: 'POST', body: undefined };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 400) throw new Error(`Expected 400, got ${res.statusCode}`);
    console.log('✓ Test 4 Passed: Undefined body handled gracefully with 400.');
  } catch (err) {
    // Error: Undefined request body must return 400 Bad Request error status instead of crashing.
    console.error('✗ Test 4 Failed:', err.message);
    process.exit(1);
  }

  // Test 5: Live AI Response — verifies the AI actually returns content
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey || groqKey.length < 10) {
    console.log('⊘ Test 5 Skipped: GROQ_API_KEY not set — cannot verify live AI response.');
  } else {
    try {
      const req = {
        method: 'POST',
        body: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Reply in one short sentence.' },
            { role: 'user', content: 'Say hello and confirm you are working.' }
          ],
          model: 'llama-3.3-70b-versatile',
          max_tokens: 100,
          temperature: 0.5
        }
      };
      const res = createMockRes();
      await handler(req, res);

      if (res.statusCode !== 200) {
        throw new Error(`Expected 200, got ${res.statusCode}. Body: ${JSON.stringify(res.body)}`);
      }

      const aiContent = res.body?.choices?.[0]?.message?.content;
      if (!aiContent || typeof aiContent !== 'string' || aiContent.trim().length === 0) {
        throw new Error('AI returned an empty or missing response content.');
      }

      console.log(`✓ Test 5 Passed: AI responded with: "${aiContent.trim().substring(0, 80)}..."`);
    } catch (err) {
      // Error: Live Groq API call failed to return a valid AI-generated text response.
      console.error('✗ Test 5 Failed:', err.message);
      process.exit(1);
    }
  }
}

testChat();
