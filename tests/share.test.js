import handler from '../api/share.js';

async function testShare() {
  console.log('--- Testing Share API Component ---');

  const origUrl = process.env.SUPABASE_URL;
  const origKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'dummy-key';

  function createMockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; },
      setHeader(name, val) { this.headers[name] = val; },
      end() { return this; }
    };
  }

  // Test 1: OPTIONS CORS preflight check
  try {
    const req = { method: 'OPTIONS' };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 200) throw new Error(`OPTIONS preflight expected 200, got ${res.statusCode}`);
    console.log('✓ Test 1 Passed: OPTIONS preflight handled successfully.');
  } catch (err) {
    // Error: OPTIONS request failed to return 200 status code for CORS preflight validation.
    console.error('✗ Test 1 Failed:', err.message);
    process.exit(1);
  }

  // Test 2: GET without ID query parameter
  try {
    const req = { method: 'GET', query: {} };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 400) throw new Error(`GET without ID expected 400, got ${res.statusCode}`);
    console.log('✓ Test 2 Passed: GET without share ID rejected.');
  } catch (err) {
    // Error: GET share requests without an id query parameter must throw a 400 Bad Request error.
    console.error('✗ Test 2 Failed:', err.message);
    process.exit(1);
  }

  // Test 3: POST without body sessionId
  try {
    const req = { method: 'POST', body: {} };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 400) throw new Error(`POST without sessionId expected 400, got ${res.statusCode}`);
    console.log('✓ Test 3 Passed: POST without sessionId rejected.');
  } catch (err) {
    // Error: POST share requests without sessionId parameter must return 400 Bad Request error.
    console.error('✗ Test 3 Failed:', err.message);
    process.exit(1);
  }

  // Test 4: Invalid Method
  try {
    const req = { method: 'PUT' };
    const res = createMockRes();
    await handler(req, res);
    if (res.statusCode !== 405) throw new Error(`PUT request expected 405, got ${res.statusCode}`);
    console.log('✓ Test 4 Passed: Invalid request methods rejected with 405.');
  } catch (err) {
    // Error: HTTP methods other than GET, POST, or OPTIONS should reject with 405 Method Not Allowed.
    console.error('✗ Test 4 Failed:', err.message);
    process.exit(1);
  } finally {
    process.env.SUPABASE_URL = origUrl;
    process.env.SUPABASE_ANON_KEY = origKey;
  }
}

testShare();
